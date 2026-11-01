import type { Turn } from '../shared/types.js';

export const geminiRpcId = 'ujx1Bf';
const unavailable =
  'Gemini did not return this conversation. Check that the share link is still public, or upload a transcript file instead.';
const generatedContent = /https?:\/\/googleusercontent\.com\/\S*_content\/\d+\s*/g;

export const geminiRequestBody = (id: string) =>
  new URLSearchParams({
    'f.req': JSON.stringify([[[geminiRpcId, JSON.stringify([null, id, [1]]), null, 'generic']]]),
  }).toString();

function responsePayload(body: string): any {
  for (const line of body.split('\n')) {
    if (!line.startsWith('[[')) continue;
    const record = (JSON.parse(line) as any[]).find(
      (r) => r[0] === 'wrb.fr' && r[1] === geminiRpcId,
    );
    if (record?.[2]) return JSON.parse(record[2]);
  }
  throw new Error(unavailable);
}

// This format is undocumented, so anything unexpected stops the import rather than guessing.
export function geminiTurns(body: string): Turn[] {
  let exchanges: any[];
  try {
    exchanges = responsePayload(body)?.[0]?.[1];
  } catch {
    throw new Error(unavailable);
  }
  if (!Array.isArray(exchanges) || !exchanges.length || exchanges.length > 2500)
    throw new Error(unavailable);
  const stamp = (e: any) => (e?.[4]?.[0] ?? 0) * 1e9 + (e?.[4]?.[1] ?? 0);
  const turns: Turn[] = [];
  for (const exchange of [...exchanges].sort((a, b) => stamp(a) - stamp(b))) {
    const question = exchange?.[2]?.[0];
    const answers = exchange?.[3]?.[0];
    const answer = Array.isArray(answers)
      ? (answers.find((a) => a?.[0] === exchange[3][3]) ?? answers[0])
      : null;
    if (!Array.isArray(question) || !Array.isArray(answer?.[1])) throw new Error(unavailable);
    const raw = answer[1].filter((part: unknown) => typeof part === 'string').join('\n');
    const media = generatedContent.test(raw);
    generatedContent.lastIndex = 0;
    const text = raw
      .replace(generatedContent, '[Non-text message content unavailable in this export]')
      .trim();
    turns.push({ id: '', role: 'student', text: question.join('\n').trim() });
    turns.push({
      id: '',
      role: 'assistant',
      text,
      ...(media ? { unavailableContent: true } : {}),
    });
  }
  if (turns.reduce((n, t) => n + t.text.length, 0) > 180000)
    throw new Error('Conversation exceeds the review limit.');
  return turns.map((t, i) => ({ ...t, id: `T${String(i + 1).padStart(3, '0')}` }));
}
