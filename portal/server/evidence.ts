import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import type { Slot, Turn, Upload, Pathway } from '../shared/types.js';
import { digest } from './store.js';
import { conversationTurns, formatTurns } from './conversation.js';
import { importChatHtml } from './shared-chat.js';
import { load } from 'cheerio';
import { parseTranscript } from './text-transcript.js';
export { parseTranscript } from './text-transcript.js';

export function essayWordCount(text: string) {
  const body = text.split(
    /^\s*(?:#{1,6}\s*)?(?:bibliography|references|works cited|sources)\s*:?[ \t]*$/im,
  )[0];
  return body.trim().split(/\s+/u).filter(Boolean).length;
}
export async function extractPdf(data: Buffer) {
  const doc = await getDocument({
    data: new Uint8Array(data),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
  }).promise;
  try {
    if (doc.numPages > 100)
      throw new Error('Please upload a document with no more than 100 pages.');
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      pages.push(
        content.items
          .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
          .join(''),
      );
    }
    return pages.join('\n\n');
  } finally {
    await doc.destroy();
  }
}
export async function validateUpload(
  name: string,
  data: Buffer,
  slot: Slot,
  pathway: Pathway | null,
): Promise<Upload> {
  if (!data.length || data.length > 10 * 1024 * 1024)
    throw new Error('Choose a non-empty file smaller than 10 MB.');
  const ext = path.extname(name).toLowerCase();
  const permitted =
    slot !== 'deliverable'
      ? ['.txt', '.md', '.pdf', '.docx', '.html', '.json']
      : pathway === 'coding'
        ? ['.py']
        : ['.pdf', '.docx'];
  if (!permitted.includes(ext))
    throw new Error(`This upload accepts ${permitted.join(', ')} files.`);
  let text = '';
  if (ext === '.pdf') {
    if (!data.subarray(0, 5).equals(Buffer.from('%PDF-')))
      throw new Error('The file is not a valid PDF.');
    text = await extractPdf(data);
  } else if (ext === '.docx') {
    if (!data.subarray(0, 2).equals(Buffer.from('PK')))
      throw new Error('The file is not a valid DOCX.');
    text = (await mammoth.extractRawText({ buffer: data })).value;
  } else {
    text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    if (text.includes('\u0000')) throw new Error('Upload readable text, not a binary file.');
  }
  text = text.trim();
  if (!text)
    throw new Error('No readable text was found. Export a text-based PDF rather than a scan.');
  if (text.length > 180000 && !['.html', '.json'].includes(ext))
    throw new Error(
      'The extracted text exceeds the 180,000-character review limit. Please contact the assessor; do not omit task messages.',
    );
  let turns: Turn[] = [];
  let parsingNote: string | undefined;
  if (slot !== 'deliverable') {
    try {
      if (ext === '.html') turns = await importChatHtml(text);
      else if (ext === '.json') {
        const value = JSON.parse(text);
        const messages =
          Array.isArray(value) &&
          value.length > 0 &&
          value.every((m) => m && typeof m === 'object' && (m.role || m.sender || m.author?.role));
        if (Array.isArray(value) && value.length !== 1 && !messages)
          throw new Error('Upload one task conversation, not an account-wide archive.');
        turns = conversationTurns(messages ? value : Array.isArray(value) ? value[0] : value);
      } else turns = parseTranscript(text);
      if (!turns.some((t) => t.role === 'student') || !turns.some((t) => t.role === 'assistant'))
        throw new Error(
          'Speakers could not be identified reliably. The original will need review before scoring.',
        );
      text = formatTurns(turns);
      if (turns.some((t) => t.unavailableContent))
        parsingNote =
          'This conversation contains attachments or media whose contents are unavailable. It needs review before automatic scoring.';
    } catch (error) {
      if (
        error instanceof Error &&
        /account-wide archive|exceeds the (review|import) limit/.test(error.message)
      )
        throw error;
      turns = [];
      parsingNote = error instanceof Error ? error.message : 'This conversation needs review.';
      if (ext === '.html') {
        const $ = load(text);
        $('script,style,nav,button').remove();
        text = $.text().trim() || 'Original HTML retained for review.';
      }
      if (text.length > 180000) {
        text = text.slice(0, 180000);
        parsingNote +=
          ' Preview shortened; the complete original is retained for review and will not be automatically scored.';
      }
    }
  }
  return {
    id: randomUUID(),
    name: path.basename(name).slice(0, 160),
    size: data.length,
    hash: digest(data),
    text,
    turns,
    words: essayWordCount(text),
    complete: false,
    extension: ext,
    kind: slot === 'deliverable' ? undefined : 'transcript',
    parseStatus: parsingNote ? 'needs_review' : 'ready',
    parsingNote,
    parserVersion: slot === 'deliverable' ? undefined : 'conversation-1.3',
  };
}

export function redact(text: string, name: string) {
  let result = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]');
  if (name.trim().length > 1)
    result = result.replace(
      new RegExp(
        `(?<![\\p{L}\\p{N}_])${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`,
        'giu',
      ),
      '[student]',
    );
  return result;
}
