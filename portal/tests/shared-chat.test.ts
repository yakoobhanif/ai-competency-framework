import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedChatUrl, extractSharedChat, sharedChatUpload } from '../server/shared-chat.js';
import { encode } from 'turbo-stream';
import { validateUpload } from '../server/evidence.js';

const nativeConversation = {
  mapping: {
    root: { parent: null, message: null },
    u: {
      parent: 'root',
      message: { author: { role: 'user' }, content: { parts: ['Help me learn attention.'] } },
    },
    a: {
      parent: 'u',
      message: { author: { role: 'assistant' }, content: { parts: ['What do you already know?'] } },
    },
    old: {
      parent: 'u',
      message: { author: { role: 'assistant' }, content: { parts: ['Discarded answer.'] } },
    },
  },
  current_node: 'a',
};

test('modern streamed pages decode split chunks, deferred data and native roles without executing scripts', async () => {
  const payload = await new Response(
    encode({ loaderData: Promise.resolve({ conversation: nativeConversation }) }),
  ).text();
  const middle = Math.floor(payload.length / 2);
  const page = [payload.slice(0, middle), payload.slice(middle)]
    .map(
      (chunk) =>
        `<script>window.__reactRouterContext.streamController.enqueue(${JSON.stringify(chunk)});throw new Error('must not execute')</script>`,
    )
    .join('');
  const imported = await sharedChatUpload(page, 'https://chatgpt.com/share/example');
  assert.deepEqual(
    imported.turns.map((t) => t.role),
    ['student', 'assistant'],
  );
  assert.equal(imported.turns[1].text, 'What do you already know?');
  assert(!imported.text.includes('Discarded'));
  assert.equal(imported.sourceHash?.length, 64);
  const uploaded = await validateUpload('conversation.html', Buffer.from(page), 'learning', null);
  assert.equal(uploaded.parseStatus, 'ready');
  assert.deepEqual(uploaded.turns, imported.turns);
});

test('native conversation exports retain authors; account archives and guessed authors are not scored', async () => {
  const result = await validateUpload(
    'chat.json',
    Buffer.from(JSON.stringify(nativeConversation)),
    'learning',
    null,
  );
  assert.equal(result.parseStatus, 'ready');
  assert.equal(result.turns.length, 2);
  const unclear = await validateUpload(
    'chat.txt',
    Buffer.from('Can you explain memory?\nHere is an explanation.'),
    'learning',
    null,
  );
  assert.equal(unclear.parseStatus, 'needs_review');
  assert.deepEqual(unclear.turns, []);
  await assert.rejects(
    validateUpload(
      'archive.json',
      Buffer.from(JSON.stringify([nativeConversation, nativeConversation])),
      'learning',
      null,
    ),
    /account-wide/,
  );
});

test('stream decoder rejects constructor tags and prototype keys instead of executing them', async () => {
  for (const payload of ['[["E",1000000000,"Uint8Array"]]\n', '[{"_1":2},"__proto__",{}]\n']) {
    const page = `<script>window.__reactRouterContext.streamController.enqueue(${JSON.stringify(payload)})</script>`;
    await assert.rejects(sharedChatUpload(page, 'https://chatgpt.com/share/test'), /safely/);
  }
});

test('missing media is visible in the preview and prevents automatic scoring', async () => {
  const data = {
    messages: [
      {
        role: 'user',
        content: { parts: ['Explain this diagram.', { content_type: 'image_asset_pointer' }] },
      },
      { role: 'assistant', content: 'The diagram shows memory systems.' },
    ],
  };
  const result = await validateUpload(
    'chat.json',
    Buffer.from(JSON.stringify(data)),
    'learning',
    null,
  );
  assert.equal(result.parseStatus, 'needs_review');
  assert.equal(result.turns[0].role, 'student');
  assert.match(result.text, /Non-text message content unavailable/);
});

test('only public ChatGPT, Claude and Gemini share URLs are accepted; tracking is removed', () => {
  assert.equal(
    sharedChatUrl('https://chatgpt.com/s/cx_abc123?utm_source=test#fragment').href,
    'https://chatgpt.com/s/cx_abc123',
  );
  assert.equal(sharedChatUrl('https://chatgpt.com/share/1234-abcd').hostname, 'chatgpt.com');
  assert.equal(sharedChatUrl('https://claude.ai/share/1234-abcd?x=1').search, '');
  assert.equal(
    sharedChatUrl('https://gemini.google.com/share/0a2dbc591ba1').hostname,
    'gemini.google.com',
  );
  assert.equal(sharedChatUrl('https://g.co/gemini/share/0a2dbc591ba1').hostname, 'g.co');
  for (const url of [
    'http://chatgpt.com/share/abc',
    'https://127.0.0.1/share/abc',
    'https://chatgpt.com.evil.test/share/abc',
    'https://chatgpt.com/c/private',
    'https://user:password@chatgpt.com/share/abc',
    'https://chatgpt.com:444/share/abc',
    'https://claude.ai/chat/private',
    'https://gemini.google.com/app/private',
    'https://g.co/other/abc',
    'https://copilot.microsoft.com/shares/abc',
  ])
    assert.throws(() => sharedChatUrl(url));
});

const html =
  '<nav>Not a message</nav><div data-message-author-role="user"><p>Explain attention.</p><p>Ask me a question.</p></div><div data-message-author-role="assistant"><p>What captures your attention?</p><button>Copy</button></div>';
test('shared text preserves order and roles, excludes chrome and remains unconfirmed', async () => {
  const result = await sharedChatUpload(html, 'https://chatgpt.com/share/abc');
  assert.deepEqual(
    result.turns.map((t) => [t.id, t.role]),
    [
      ['T001', 'student'],
      ['T002', 'assistant'],
    ],
  );
  assert.match(result.turns[0].text, /Explain attention\.\nAsk me a question\./);
  assert.doesNotMatch(result.text, /Copy|Not a message/);
  assert.equal(result.complete, false);
  assert.equal(result.name, 'Shared conversation.txt');
  assert.equal(result.sourceUrl, 'https://chatgpt.com/share/abc');
  assert.equal(result.hash.length, 64);
});

test('blocked, login-only, one-sided, oversized and multimedia pages are not graded', () => {
  for (const page of [
    '<h1>Just a moment</h1>',
    '<h1>Sign in</h1>',
    '<div data-message-author-role="assistant">One answer</div>',
    html.replace('Explain attention.', '<img src="image.png">'),
    html.replace('Explain attention.', 'x'.repeat(180001)),
  ])
    assert.throws(() => extractSharedChat(page));
});

test('structured legacy conversations follow selected branch, not discarded answers', () => {
  const message = (role: string, text: string) => ({
    author: { role },
    content: { parts: [text] },
  });
  const mapping = {
    root: { parent: null, message: null },
    user: { parent: 'root', message: message('user', 'Help me study') },
    old: { parent: 'user', message: message('assistant', 'Discarded') },
    selected: { parent: 'user', message: message('assistant', 'Selected answer') },
  };
  const data = {
    props: { pageProps: { serverResponse: { data: { mapping, current_node: 'selected' } } } },
  };
  const turns = extractSharedChat(
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`,
  );
  assert.deepEqual(
    turns.map((t) => t.text),
    ['Help me study', 'Selected answer'],
  );
  mapping.root.parent = 'selected' as any;
  assert.throws(() =>
    extractSharedChat(`<script id="__NEXT_DATA__">${JSON.stringify(data)}</script>`),
  );
});

const geminiBody = (exchanges: unknown[]) =>
  `)]}'\n\n123\n${JSON.stringify([
    [
      'wrb.fr',
      'ujx1Bf',
      JSON.stringify([[null, exchanges], null, true]),
      null,
      null,
      null,
      'generic',
    ],
  ])}\n`;
const geminiExchange = (question: string, answer: string, seconds: number) => [
  ['c_1', 'r_1'],
  null,
  [[question], 2, null, 0],
  [[['rc_1', [answer]]], null, null, 'rc_1'],
  [seconds, 0],
];

test('Gemini shares import in time order with both speakers', async () => {
  const body = geminiBody([
    geminiExchange('Second question', 'Second answer', 200),
    geminiExchange('First question', 'First answer', 100),
  ]);
  const result = await sharedChatUpload(body, 'https://gemini.google.com/share/abc');
  assert.deepEqual(
    result.turns.map((t) => [t.role, t.text]),
    [
      ['student', 'First question'],
      ['assistant', 'First answer'],
      ['student', 'Second question'],
      ['assistant', 'Second answer'],
    ],
  );
  assert.equal(result.parseStatus, 'ready');
});

test('Gemini generated images and removed shares are never scored silently', async () => {
  const image = await sharedChatUpload(
    geminiBody([
      geminiExchange(
        'Draw this',
        'http://googleusercontent.com/image_generation_content/119\n\n',
        1,
      ),
    ]),
    'https://gemini.google.com/share/abc',
  );
  assert.equal(image.parseStatus, 'needs_review');
  assert.match(image.text, /Non-text message content unavailable/);
  await assert.rejects(
    sharedChatUpload(
      `)]}'\n\n99\n[["wrb.fr","ujx1Bf",null,null,null,[5],"generic"]]\n`,
      'https://gemini.google.com/share/gone',
    ),
    /did not return this conversation/,
  );
});

test('Claude share snapshots import with both speakers', async () => {
  const body = JSON.stringify({
    chat_messages: [
      { sender: 'human', content: [{ type: 'text', text: 'Explain chunking.' }] },
      { sender: 'assistant', content: [{ type: 'text', text: 'It groups items.' }] },
    ],
  });
  const result = await sharedChatUpload(body, 'https://claude.ai/share/abc');
  assert.deepEqual(
    result.turns.map((t) => [t.role, t.text]),
    [
      ['student', 'Explain chunking.'],
      ['assistant', 'It groups items.'],
    ],
  );
});

test('a Claude page saved from the browser keeps its speakers', async () => {
  const page =
    '<div>Shared by Sam</div><div data-testid="user-message"><p>Explain chunking.</p></div><div class="font-claude-response relative"><div class="standard-markdown"><p>It groups items.</p></div><button>Copy</button></div>';
  const upload = await validateUpload('claude.html', Buffer.from(page), 'learning', null);
  assert.deepEqual(
    upload.turns.map((t) => [t.role, t.text]),
    [
      ['student', 'Explain chunking.'],
      ['assistant', 'It groups items.'],
    ],
  );
  assert.equal(upload.parseStatus, 'ready');
});
