import { load } from 'cheerio';
import { Worker } from 'node:worker_threads';
import type { Turn } from '../shared/types.js';

const incomplete =
  'The conversation structure is incomplete or ambiguous. Upload a complete export of this task conversation.';
export const unavailableMarker = '[Non-text message content unavailable in this export]';
export const unavailableNote =
  'This conversation includes attachments or media the portal cannot read. They are marked in the preview, and the rest of the conversation will still be scored.';

export function conversationTurns(conversation: any): Turn[] {
  // Single-conversation exports may be a bare message list or a Gemini contents list.
  if (Array.isArray(conversation)) conversation = { messages: conversation };
  let messages: any[];
  if (conversation?.mapping) {
    const mapping = conversation.mapping;
    const keys = Object.keys(mapping);
    if (keys.length > 5000) throw new Error(incomplete);
    let id = conversation.current_node;
    if (!id) {
      const parents = new Set(Object.values(mapping).map((node: any) => node?.parent));
      const leaves = keys.filter((key) => !parents.has(key));
      if (leaves.length !== 1) throw new Error(incomplete);
      id = leaves[0];
    }
    const branch: any[] = [],
      visited = new Set<string>();
    while (id) {
      if (visited.has(id) || visited.size > 5000 || !Object.hasOwn(mapping, id))
        throw new Error(incomplete);
      visited.add(id);
      const node = mapping[id];
      branch.push(node.message);
      id = node.parent;
    }
    messages = branch.reverse();
  } else if (Array.isArray(conversation?.linear_conversation)) {
    messages = conversation.linear_conversation.map(
      (n: any) => n.message ?? (n.author || n.role ? n : null),
    );
  } else if (Array.isArray(conversation?.chat_messages)) {
    messages = conversation.chat_messages;
  } else if (Array.isArray(conversation?.messages)) {
    messages = conversation.messages;
  } else if (Array.isArray(conversation?.contents)) {
    messages = conversation.contents;
  } else throw new Error(incomplete);
  if (messages.length > 5000) throw new Error(incomplete);

  const turns: Turn[] = [];
  for (const message of messages) {
    if (!message) continue;
    const originalRole = String(
      message.author?.role ?? message.role ?? message.sender ?? '',
    ).toLowerCase();
    if (originalRole === 'system' || originalRole === 'developer') continue;
    if (
      message.metadata?.is_visually_hidden_from_conversation ||
      ['model_editable_context', 'user_editable_context', 'thoughts', 'reasoning_recap'].includes(
        message.content?.content_type,
      )
    )
      continue;
    const role = ['user', 'human', 'student'].includes(originalRole)
      ? 'student'
      : ['assistant', 'model', 'chatgpt', 'claude', 'gemini', 'copilot'].includes(originalRole)
        ? 'assistant'
        : originalRole === 'tool'
          ? 'tool'
          : null;
    if (!role) throw new Error(incomplete);
    const content = message.content;
    const parts =
      content?.parts ??
      message.parts ??
      (typeof content === 'string'
        ? [content]
        : Array.isArray(content)
          ? content
          : typeof content?.text === 'string'
            ? [content.text]
            : typeof message.text === 'string'
              ? [message.text]
              : null);
    if (!Array.isArray(parts)) throw new Error(incomplete);
    let unavailableContent = false;
    const text = parts
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (['thinking', 'redacted_thinking'].includes(part?.type) || part?.thought === true)
          return '';
        if (typeof part?.text === 'string' && (!part.type || part.type === 'text'))
          return part.text;
        unavailableContent = true;
        return unavailableMarker;
      })
      .join('\n')
      .trim();
    const attachments = message.metadata?.attachments ?? message.attachments;
    const attachmentText =
      Array.isArray(attachments) && attachments.length
        ? attachments
            .map(
              (a: any) =>
                `[Attachment: ${String(a.name ?? a.file_name ?? 'file').slice(0, 200)}; file contents not included]`,
            )
            .join('\n')
        : '';
    if (attachmentText) unavailableContent = true;
    if (text || attachmentText)
      turns.push({
        id: `T${String(turns.length + 1).padStart(3, '0')}`,
        role,
        text: [text, attachmentText].filter(Boolean).join('\n'),
        ...(unavailableContent ? { unavailableContent: true } : {}),
      });
  }
  if (!turns.some((t) => t.role === 'student') || !turns.some((t) => t.role === 'assistant'))
    throw new Error(incomplete);
  if (turns.reduce((n, t) => n + t.text.length, 0) > 180000)
    throw new Error('Conversation exceeds the review limit.');
  return turns;
}

export async function streamedConversation(html: string): Promise<Turn[] | null> {
  const $ = load(html),
    chunks: string[] = [];
  $('script').each((_i, element) => {
    const script = $(element).text();
    // Read JSON string literals only. Never execute scripts from the shared page.
    for (const match of script.matchAll(/streamController\.enqueue\(\s*("(?:\\.|[^"\\])*")\s*\)/g))
      chunks.push(JSON.parse(match[1]));
  });
  if (!chunks.length) return null;
  const data = chunks.join('');
  if (data.length > 2_000_000) throw new Error('Shared conversation exceeds the import limit.');
  const value = await new Promise<unknown>((resolve, reject) => {
    const worker = new Worker(new URL('./stream-decoder.mjs', import.meta.url), {
      workerData: data,
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16 },
    });
    let settled = false;
    const finish = (error?: Error, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(
      () => finish(new Error('Chat decoding timed out. Upload a transcript file instead.')),
      5000,
    );
    worker.once('message', (message) =>
      finish(message.error ? new Error(message.error) : undefined, message.value),
    );
    worker.once('error', () => finish(new Error(incomplete)));
    worker.once('exit', () => {
      if (!settled) finish(new Error(incomplete));
    });
  });
  return conversationTurns(value);
}

// Current ChatGPT share pages embed the visible conversation as JSON. Parse it; never execute it.
export function webMobileConversation(html: string): Turn[] | null {
  const script = load(html)('script#__WEB_MOBILE_DATA__[type="application/json"]').first();
  if (!script.length) return null;
  let data: any;
  try {
    data = JSON.parse(script.text());
  } catch {
    return null;
  }
  const messages = data?.conversation?.messages;
  if (!Array.isArray(messages) || messages.length > 5000) return null;
  try {
    return conversationTurns(
      messages.map((m: any) => ({
        role: m?.role,
        content: typeof m?.content === 'string' ? m.content : [{ type: 'unavailable' }],
        attachments: Array.isArray(m?.maskedUploads) ? m.maskedUploads.map(() => ({})) : [],
      })),
    );
  } catch (error) {
    if (error instanceof Error && /exceeds the review limit/.test(error.message)) throw error;
    return null;
  }
}

export function formatTurns(turns: Turn[]): string {
  return turns
    .map(
      (t) =>
        `${t.role === 'student' ? 'User' : t.role === 'tool' ? 'Tool' : 'Assistant'}:\n${t.text}`,
    )
    .join('\n\n');
}
