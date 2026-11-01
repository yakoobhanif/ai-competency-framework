import type { Turn } from '../shared/types.js';

export function parseTranscript(text: string): Turn[] {
  const turns: Turn[] = [];
  let current: Turn | null = null;
  let fence: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const delimiter = raw.match(/^\s*(`{3,}|~{3,})/);
    const withinCode = fence !== null || !!delimiter;
    if (delimiter) {
      if (fence === null) fence = delimiter[1];
      else if (delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length) fence = null;
    }
    const line = raw
      .replace(/^\s*#{1,6}\s*/, '')
      .replace(/\*\*/g, '')
      .replace(/^\[([^\]]+)\](?=\s*[:：]|$)/, '$1')
      .trim();
    const role =
      !withinCode &&
      line.match(
        /^(user|you|human|student|assistant|chatgpt|claude|gemini|copilot|ai|tool)(?:\s+(?:said|asked|replied|responded))?(?:\s*[:：]\s*(.*)|\s*)$/i,
      );
    if (role) {
      if (current && current.text.trim()) turns.push({ ...current, text: current.text.trim() });
      current = {
        id: '',
        role: /^(user|you|human|student)$/i.test(role[1])
          ? 'student'
          : /^tool$/i.test(role[1])
            ? 'tool'
            : 'assistant',
        text: role[2] || '',
      };
    } else if (current) current.text += '\n' + raw;
  }
  if (current && current.text.trim()) turns.push({ ...current, text: current.text.trim() });
  return turns.map((t, i) => ({ ...t, id: `T${String(i + 1).padStart(3, '0')}` }));
}
