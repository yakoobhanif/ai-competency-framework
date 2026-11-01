import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationTurns } from '../server/conversation.js';
import { validateUpload, parseTranscript } from '../server/evidence.js';
import { importChatHtml } from '../server/shared-chat.js';

test('native Gemini and assistant code blocks retain explicit authors and text', () => {
  const turns = conversationTurns({
    contents: [
      { role: 'user', parts: [{ text: 'Explain this code.' }] },
      {
        role: 'model',
        parts: [
          { text: 'Private thought', thought: true },
          { text: 'The loop sums the differences.' },
        ],
      },
    ],
  });
  assert.deepEqual(
    turns.map((t) => t.role),
    ['student', 'assistant'],
  );
  assert(!turns[1].text.includes('Private thought'));
  assert.equal(
    conversationTurns({
      messages: [
        { role: 'user', content: 'Write code.' },
        { role: 'assistant', content: { content_type: 'code', text: 'print(1)' } },
      ],
    })[1].text,
    'print(1)',
  );
});

test('bare message arrays are conversations while multi-conversation archives are rejected', async () => {
  const result = await validateUpload(
    'chat.json',
    Buffer.from(
      JSON.stringify([
        { role: 'user', content: 'Help me study.' },
        { role: 'assistant', content: 'What is confusing?' },
      ]),
    ),
    'learning',
    null,
  );
  assert.equal(result.parseStatus, 'ready');
  assert.equal(result.turns.length, 2);
  await assert.rejects(
    validateUpload(
      'archive.json',
      Buffer.from('[{"messages":[]},{"messages":[]}]'),
      'learning',
      null,
    ),
    /account-wide/,
  );
});

test('natural export headings and nested fences preserve student attribution', () => {
  const turns = parseTranscript(
    'You asked:\nHelp me understand.\nGemini replied:\n````python\n```\nUser: this is code content\n````\n[User]: My explanation is...',
  );
  assert.equal(turns.length, 3);
  assert.equal(turns[1].role, 'assistant');
  assert(turns[1].text.includes('User: this is code content'));
  assert.equal(turns[2].role, 'student');
});

test('saved HTML speaker headings can be read when hydration cannot be decoded', async () => {
  const turns = await importChatHtml(
    '<script>streamController.enqueue("invalid")</script><main><h2>You said:</h2><p>Explain memory.</p><h2>Assistant replied:</h2><p>Try retrieval practice.</p></main>',
  );
  assert.equal(turns.length, 2);
  assert.equal(turns[0].text, 'Explain memory.');
  assert.equal(turns[1].role, 'assistant');
});
