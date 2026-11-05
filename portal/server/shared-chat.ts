import dns from 'node:dns/promises';
import { randomUUID } from 'node:crypto';
import { Agent, request } from 'undici';
import { load } from 'cheerio';
import { isPublicIp } from './sources.js';
import { digest } from './store.js';
import type { Turn, Upload } from '../shared/types.js';
import {
  conversationTurns,
  streamedConversation,
  webMobileConversation,
  formatTurns,
  unavailableMarker,
  unavailableNote,
} from './conversation.js';
import { parseTranscript } from './text-transcript.js';
import { geminiRpcId, geminiRequestBody, geminiTurns } from './gemini-chat.js';

const unavailable =
  'The chat provider did not make the full conversation readable to this portal. Check that this is a public whole-conversation link, or upload a transcript file instead.';

const sharePaths: Record<string, RegExp> = {
  'chatgpt.com': /^\/(?:share\/[a-zA-Z0-9-]+|s\/cx_[a-zA-Z0-9_-]+)\/?$/,
  'chat.openai.com': /^\/(?:share\/[a-zA-Z0-9-]+|s\/cx_[a-zA-Z0-9_-]+)\/?$/,
  'claude.ai': /^\/share\/[a-zA-Z0-9-]+\/?$/,
  'gemini.google.com': /^\/share\/[a-zA-Z0-9_-]+\/?$/,
  'g.co': /^\/gemini\/share\/[a-zA-Z0-9_-]+\/?$/,
};

export function sharedChatUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Enter a valid public conversation link.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !Object.hasOwn(sharePaths, url.hostname) ||
    !sharePaths[url.hostname].test(url.pathname)
  ) {
    throw new Error(
      'Only public ChatGPT, Gemini and Claude share links can be imported. For other tools, upload your conversation as a file.',
    );
  }
  url.search = '';
  url.hash = '';
  return url;
}

const shareId = (url: URL) => url.pathname.replace(/\/$/, '').split('/').pop()!;

// Claude and Gemini share pages load the conversation with a second request after the
// page opens, so ask for that public data directly. Nothing here sends student credentials.
function shareRequest(url: URL) {
  if (url.hostname === 'claude.ai')
    return {
      target: new URL(
        `https://claude.ai/api/chat_snapshots/${shareId(url)}?rendering_mode=messages&render_all_tools=true`,
      ),
      options: { method: 'GET' as const, headers: { accept: 'application/json' } },
      contentType: 'json',
    };
  if (url.hostname === 'gemini.google.com')
    return {
      target: new URL(
        `https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=${geminiRpcId}&rt=c`,
      ),
      options: {
        method: 'POST' as const,
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: geminiRequestBody(shareId(url)),
      },
      contentType: 'json',
    };
  return {
    target: url,
    // ChatGPT serves a preview stub without the conversation to non-browser user agents.
    options: {
      method: 'GET' as const,
      headers: {
        accept: 'text/html',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
    },
    contentType: 'text/html',
  };
}

export async function fetchSharedChat(
  raw: string,
  redirects = 0,
): Promise<{ url: string; html: string }> {
  const url = sharedChatUrl(raw);
  if (redirects > 3) throw new Error('Too many redirects. Use the final public share link.');
  const { target, options, contentType } = shareRequest(url);
  const addresses = await dns.lookup(target.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some((a) => !isPublicIp(a.address)))
    throw new Error('The share link has an unsupported network address.');
  const agent = new Agent({
    connect: {
      autoSelectFamily: false,
      lookup: (_host, _opts, callback) => callback(null, addresses[0].address, 4),
    },
  });
  try {
    const response = await request(target, {
      ...options,
      dispatcher: agent,
      signal: AbortSignal.timeout(15000),
      headersTimeout: 10000,
      bodyTimeout: 10000,
      headers: { 'user-agent': 'AICompetencyResearch/1.0', ...options.headers },
    });
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      await response.body.dump();
      if (!response.headers.location) throw new Error(unavailable);
      return await fetchSharedChat(
        new URL(String(response.headers.location), url).href,
        redirects + 1,
      );
    }
    if (
      response.statusCode !== 200 ||
      !String(response.headers['content-type']).includes(contentType)
    ) {
      await response.body.dump();
      if (response.statusCode === 403)
        throw new Error(
          url.hostname === 'claude.ai'
            ? 'Claude blocked the automatic import. Open your share link in your browser, save the page as "Webpage, Complete", and upload the saved .html file below.'
            : 'The chat provider blocked this import (403). Upload your conversation as a file instead.',
        );
      throw new Error(unavailable);
    }
    return { url: url.href, html: await readSharePage(response.body, shareByteLimit(url)) };
  } finally {
    await agent.close();
  }
}

// ChatGPT sends browsers its whole app page, which passes 2 MB even for short chats.
// The extracted text must still fit the 180000-character review limit.
export function shareByteLimit(url: URL): number {
  return url.hostname === 'chatgpt.com' ? 20_000_000 : 2_000_000;
}

export async function readSharePage(body: AsyncIterable<Uint8Array>, limit: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of body) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > limit)
      throw new Error(
        'Shared chat exceeds the import limit. Use a complete transcript file instead.',
      );
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function extractSharedChat(html: string): Turn[] {
  const $ = load(html);
  const turns: Turn[] = [];
  // Use explicit provider role markers, never infer authors from arbitrary page text.
  $('[data-message-author-role]').each((_i, element) => {
    const node = $(element);
    if (node.parents('[data-message-author-role]').length) return;
    const role = node.attr('data-message-author-role');
    if (role !== 'user' && role !== 'assistant') return;
    const content = node.clone();
    const media = content.find('img,video,audio,iframe');
    const unavailableContent = media.length > 0;
    media.replaceWith(unavailableMarker);
    content.find('script,style,button,svg').remove();
    content.find('br').replaceWith('\n');
    content.find('p,div,li,pre,h1,h2,h3,tr').append('\n');
    const text = content.text().trim();
    if (text)
      turns.push({
        id: '',
        role: role === 'user' ? 'student' : 'assistant',
        text,
        ...(unavailableContent ? { unavailableContent: true } : {}),
      });
  });
  // A Claude page saved from the browser marks speakers with these two hooks.
  if (!turns.length)
    $('[data-testid="user-message"], .font-claude-response').each((_i, element) => {
      const node = $(element);
      const content = node.clone();
      const media = content.find('img,video,audio,iframe');
      const unavailableContent = media.length > 0;
      media.replaceWith(unavailableMarker);
      content.find('script,style,button,svg').remove();
      content.find('br').replaceWith('\n');
      content.find('p,div,li,pre,h1,h2,h3,tr').append('\n');
      const text = content.text().trim();
      if (text)
        turns.push({
          id: '',
          role: node.is('[data-testid="user-message"]') ? 'student' : 'assistant',
          text,
          ...(unavailableContent ? { unavailableContent: true } : {}),
        });
    });
  // Legacy public pages embed a conversation tree. Follow only its selected branch.
  if (!turns.length) {
    const script = $('#__NEXT_DATA__').text();
    if (script) {
      let data: any;
      try {
        data = JSON.parse(script);
      } catch {
        throw new Error(unavailable);
      }
      const candidates = [
        data?.props?.pageProps?.serverResponse?.data,
        data?.props?.pageProps?.conversation,
      ];
      const conversation = candidates.find((c) => c?.mapping && c?.current_node);
      if (conversation) {
        const branch: any[] = [],
          visited = new Set<string>();
        let id: string | null = conversation.current_node;
        while (id) {
          if (visited.has(id) || visited.size > 5000 || !conversation.mapping[id])
            throw new Error(
              'The shared conversation structure is incomplete. Use a full transcript instead.',
            );
          visited.add(id);
          const node: any = conversation.mapping[id];
          branch.push(node.message);
          id = node.parent;
        }
        for (const message of branch.reverse()) {
          const role = message?.author?.role;
          if (role !== 'user' && role !== 'assistant') continue;
          const parts = message?.content?.parts;
          if (!Array.isArray(parts))
            throw new Error(
              'This chat includes content we cannot import reliably. Use a complete text transcript and check the preview.',
            );
          const unavailableContent = parts.some((p) => typeof p !== 'string');
          const text = parts
            .map((p) => (typeof p === 'string' ? p : unavailableMarker))
            .join('\n')
            .trim();
          if (text)
            turns.push({
              id: '',
              role: role === 'user' ? 'student' : 'assistant',
              text,
              ...(unavailableContent ? { unavailableContent: true } : {}),
            });
        }
      }
    }
  }
  if (!turns.some((t) => t.role === 'student') || !turns.some((t) => t.role === 'assistant'))
    throw new Error(unavailable);
  if (turns.reduce((n, t) => n + t.text.length, 0) > 180000)
    throw new Error(
      'The conversation exceeds the review limit. Contact the assessor; do not omit messages.',
    );
  return turns.map((t, i) => ({ ...t, id: `T${String(i + 1).padStart(3, '0')}` }));
}

export async function importChatHtml(html: string): Promise<Turn[]> {
  // Hydration data preserves authors and the selected branch on current share pages.
  let streamError: unknown;
  try {
    const streamed = await streamedConversation(html);
    if (streamed) return streamed;
  } catch (error) {
    streamError = error;
  }
  const embedded = webMobileConversation(html);
  if (embedded) return embedded;
  try {
    return extractSharedChat(html);
  } catch (error) {
    // Saved browser pages can retain visible speaker headings without hydration metadata.
    const $ = load(html);
    $('script,style,nav,button,header,footer').remove();
    $('br').replaceWith('\n');
    $('p,div,li,pre,h1,h2,h3,h4,tr,section,article').append('\n');
    const turns = parseTranscript($.text());
    if (turns.some((t) => t.role === 'student') && turns.some((t) => t.role === 'assistant')) {
      if (turns.reduce((sum, t) => sum + t.text.length, 0) > 180000)
        throw new Error('Conversation exceeds the review limit.');
      if ($('img,video,audio,iframe').length)
        for (const turn of turns) turn.unavailableContent = true;
      return turns;
    }
    throw streamError || error;
  }
}

async function sharedTurns(body: string, url: string): Promise<Turn[]> {
  const { hostname } = new URL(url);
  if (hostname === 'gemini.google.com') return geminiTurns(body);
  if (hostname !== 'claude.ai') return importChatHtml(body);
  let snapshot: unknown;
  try {
    snapshot = JSON.parse(body);
  } catch {
    throw new Error(unavailable);
  }
  return conversationTurns(snapshot);
}

export async function sharedChatUpload(html: string, url: string): Promise<Upload> {
  const turns = await sharedTurns(html, url);
  const text = formatTurns(turns);
  return {
    id: randomUUID(),
    name: 'Shared conversation.txt',
    size: Buffer.byteLength(text),
    hash: digest(text),
    text,
    turns,
    words: text.split(/\s+/).length,
    complete: false,
    extension: '.txt',
    sourceUrl: url,
    importedAt: new Date().toISOString(),
    kind: 'transcript',
    parseStatus: 'ready',
    parsingNote: turns.some((t) => t.unavailableContent) ? unavailableNote : undefined,
    sourceHash: digest(html),
    parserVersion: 'conversation-1.5',
  };
}
