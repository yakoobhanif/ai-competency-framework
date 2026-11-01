import test from 'node:test';
import assert from 'node:assert/strict';
import { publicContent, quizKey, capabilities } from '../server/content.js';
import { calculateReport, quizScores } from '../server/scoring.js';
import { parseTranscript, essayWordCount, validateUpload, redact } from '../server/evidence.js';
import { oracle, testCases } from '../server/code-runner.js';
import { isPublicIp } from '../server/sources.js';
import { gradeTranscript } from '../server/providers.js';
import { transcript, fixtureAttempt, observations, essayDocx } from './fixtures.js';
import { summaryFallback } from '../server/summaries.js';

test('instrument coverage and private answer key', () => {
  assert.equal(publicContent.self.length, 25);
  assert.equal(publicContent.quiz.length, 25);
  assert.deepEqual(
    publicContent.self.map((q) => q.id),
    capabilities.map((c) => c.id),
  );
  assert.equal(
    Object.values(quizKey).reduce((s, q) => s + q.max, 0),
    25,
  );
  assert.equal(
    Object.values(quizKey)
      .map((q) => Object.entries(q.points).find(([, p]) => p === q.max)![0])
      .join(','),
    'B,D,C,A,B,B,C,B,A,C,A,C,C,B,A,D,C,B,B,A,D,D,C,B,D',
  );
  assert(!JSON.stringify(publicContent).includes('capability_quiz_key'));
  assert(publicContent.quiz.every((q) => q.options?.length === 4));
});
test('all 100 quiz options have short static review labels', () => {
  const options = publicContent.quiz.flatMap((q) => q.options!);
  assert.equal(options.length, 100);
  for (const q of publicContent.quiz) {
    assert.equal(new Set(q.options!.map((o) => o.summary)).size, 4);
    for (const o of q.options!) {
      assert.equal(o.summary, o.summary.trim());
      assert(o.summary.split(/\s+/).length >= 2 && o.summary.split(/\s+/).length <= 7);
      assert.notEqual(o.summary, o.text);
      assert(!/^([A-D]|Correct|Incorrect|Full credit|No credit)$/i.test(o.summary));
    }
  }
});
test('every approved quiz option has binary scoring; skips are zero and missing answers remain unknown', () => {
  assert.deepEqual(
    Object.values(quizKey).map((q) => q.capability),
    capabilities.map((c) => c.id),
  );
  for (const [id, key] of Object.entries(quizKey)) {
    assert.equal(key.max, 1);
    assert.equal(Object.values(key.points).filter((p) => p === 1).length, 1);
    for (const [option, points] of Object.entries(key.points)) {
      assert(points === 0 || points === 1);
      const scores = quizScores({ [id]: option as 'A' | 'B' | 'C' | 'D' });
      assert.deepEqual(scores[key.capability], {
        earned: points,
        max: 1,
        value: points * 100,
        missing: false,
      });
      assert(
        Object.entries(scores)
          .filter(([cap]) => cap !== key.capability)
          .every(([, s]) => s.missing && s.value === null),
      );
    }
    assert.deepEqual(quizScores({ [id]: 'not_sure' })[key.capability], {
      earned: 0,
      max: 1,
      value: 0,
      missing: false,
    });
  }
  const full = Object.fromEntries(
    Object.entries(quizKey).map(([id, key]) => [
      id,
      Object.entries(key.points).find(([, p]) => p === 1)![0] as 'A' | 'B' | 'C' | 'D',
    ]),
  );
  assert(
    Object.values(quizScores(full)).every((s) => s.earned === 1 && s.value === 100 && !s.missing),
  );
  delete full.Q22;
  assert.equal(quizScores(full).R3.value, null);
  assert.equal(quizScores(full).R2.value, 100);
});
test('self-assessment has five unique capability-specific anchors and synced source copies', () => {
  const anchors = publicContent.self.flatMap((q) => q.selfDescriptions || []);
  assert.equal(anchors.length, 125);
  assert.equal(new Set(anchors).size, 125);
  for (const q of publicContent.self) {
    assert.equal(q.selfDescriptions?.length, 5);
    assert(q.selfDescriptions!.every((s) => s.startsWith('I ') && !s.includes('|')));
    assert.equal(q.note, undefined);
  }
  assert.equal(
    publicContent.self[0].prompt,
    'How well can you explain how AI systems learn or follow rules to perform tasks?',
  );
});
test('C5 uses the deliverable outcome with the shared boost', () => {
  const report = calculateReport(fixtureAttempt(), observations(), {
    verdict: 'Pass',
    criteria: [],
    checks: {},
  });
  assert.equal(report.capabilities.find((c) => c.id === 'C5')!.score, 50);
});
test('missing practical evidence retains baseline or eligible other-task evidence', () => {
  const obs = observations().filter(
    (o) => o.capability !== 'U2' && !(o.capability === 'R5' && o.task === 'learning'),
  );
  const r = calculateReport(fixtureAttempt(), obs, {
    verdict: 'Pending',
    criteria: [],
    checks: {},
  });
  assert.equal(r.capabilities.find((c) => c.id === 'R5')!.score, 100);
  assert.notEqual(r.views!.both.dimensions.find((d) => d.id === 'R')!.score, null);
  assert.equal(
    r.capabilities.find((c) => c.id === 'U2')!.score,
    r.capabilities.find((c) => c.id === 'U2')!.quiz,
  );
  assert.equal(
    r.capabilities.find((c) => c.id === 'C5')!.score,
    r.capabilities.find((c) => c.id === 'C5')!.quiz,
  );
  assert.notEqual(r.views!.both.dimensions.find((d) => d.id === 'C')!.score, null);
});
test('self-ratings never change performance and the overlay needs 80% coverage', () => {
  const a = fixtureAttempt(),
    r = calculateReport(a, observations(), { verdict: 'Fail', criteria: [], checks: {} });
  a.self.U1 = 'not_sure';
  a.self.U2 = 'not_sure';
  a.self.C1 = 5;
  const altered = calculateReport(a, observations(), r.deliverable);
  assert.deepEqual(
    altered.capabilities.map((c) => c.score),
    r.capabilities.map((c) => c.score),
  );
  assert.equal(altered.views!.quiz.dimensions[0].self, null);
  assert.equal(altered.capabilities.find((c) => c.id === 'C5')!.score, 0);
});
test('transcript roles and current export formats', () => {
  assert.equal(parseTranscript(transcript).filter((t) => t.role === 'student').length, 4);
  assert.equal(
    parseTranscript('### User\nMy question\n**Assistant:** Answer')[1].role,
    'assistant',
  );
  assert.equal(parseTranscript('A: not a supported speaker').length, 0);
  assert.equal(parseTranscript('User: I think\nTool: 42\nAssistant: Good')[1].role, 'tool');
});
test('upload validation and document extraction', async () => {
  const unclear = await validateUpload(
    'bad.txt',
    Buffer.from('An unlabelled conversation'),
    'learning',
    null,
  );
  assert.equal(unclear.parseStatus, 'needs_review');
  assert.deepEqual(unclear.turns, []);
  await assert.rejects(
    validateUpload('bad.pdf', Buffer.from('Not a PDF'), 'learning', null),
    /valid PDF/,
  );
  await assert.rejects(
    validateUpload('bad.exe', Buffer.from('User: a\nAssistant: b'), 'learning', null),
    /accepts/,
  );
  await assert.rejects(validateUpload('empty.txt', Buffer.alloc(0), 'learning', null), /non-empty/);
  const good = await validateUpload('chat.md', Buffer.from(transcript), 'learning', null);
  assert.equal(good.complete, false);
  assert.equal(good.hash.length, 64);
  const essay = await validateUpload('essay.docx', await essayDocx(), 'deliverable', 'essay');
  assert(essay.words < 1000);
  assert(essay.text.includes('Recommendation algorithms'));
});
test('word count excludes bibliography but includes headings', () => {
  assert.equal(essayWordCount('A title\nOne two three\nReferences\nSource one two three'), 5);
  assert.equal(essayWordCount('References are useful.\nOne two'), 5);
});
test('identity redaction and SSRF boundaries', () => {
  assert.equal(
    redact("Ali checks validity, quality and personalization. Ali's notes are clear.", 'Ali'),
    "[student] checks validity, quality and personalization. [student]'s notes are clear.",
  );
  assert.equal(
    redact('Éva reviews évaluations. Éva agrees.', 'Éva'),
    '[student] reviews évaluations. [student] agrees.',
  );
  assert.equal(redact('Dr. Ali checks a claim.', 'Dr. Ali'), '[student] checks a claim.');
  assert(!redact('Alex Example emailed a@b.com', 'Alex Example').includes('Alex Example'));
  for (const ip of [
    '127.0.0.1',
    '10.1.2.3',
    '192.168.1.3',
    '172.16.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '::1',
    '0.0.0.0',
  ])
    assert.equal(isPublicIp(ip), false, ip);
  assert(isPublicIp('8.8.8.8'));
});
test('coding oracle covers constraints and exact large integers', () => {
  assert.equal(oracle([2, 5], [4, 1]), 6);
  assert.equal(oracle([10], [900]), 0);
  assert.equal(testCases().length, 100);
  assert.equal(oracle([1, 1e9, 1e9], [1e9, 1, 1e9]), 2999999997);
});
test('demo feedback is explicitly illustrative and does not call a provider', async () => {
  const r = calculateReport(fixtureAttempt(), observations(), {
    verdict: 'Pass',
    criteria: [],
    checks: {},
  });
  assert.equal(summaryFallback(r, 'quiz').source, 'demo');
});

test('no-AI accounts preserve quiz baselines and cannot create transcript scores, including in demo', async () => {
  const a = fixtureAttempt();
  const account = await validateUpload(
    'account.txt',
    Buffer.from('I used the slides and tested myself from memory.'),
    'learning',
    null,
  );
  account.kind = 'no_ai';
  a.uploads.learning = account;
  a.uploads.creation = account;
  const obs = [
    ...(await gradeTranscript(a, 'learning', '')),
    ...(await gradeTranscript(a, 'creation', '')),
  ];
  assert(obs.every((o) => o.status === 'absent' && o.score === null));
  const report = calculateReport(a, obs, { verdict: 'Pass', criteria: [], checks: {} });
  assert.equal(
    report.capabilities.find((c) => c.id === 'L1')!.score,
    report.capabilities.find((c) => c.id === 'L1')!.quiz,
  );
  const r5 = report.capabilities.find((c) => c.id === 'R5')!;
  assert.equal(r5.score, r5.quiz);
  account.kind = 'transcript';
  account.parseStatus = 'needs_review';
  assert(
    (await gradeTranscript(a, 'learning', '')).every(
      (o) => o.status === 'pending' && o.score === null,
    ),
  );
});

test('role-like content inside a fenced code block is not a new speaker', () => {
  const turns = parseTranscript(
    'User: Show code\nAssistant:\n```text\nUser: quoted example\n```\nUser: Thanks',
  );
  assert.equal(turns.length, 3);
  assert.match(turns[1].text, /User: quoted example/);
});

test("the coding problem's official sample agrees with the hidden-test oracle", () => {
  const problem = publicContent.codingProblem;
  const blocks = [...problem.matchAll(/```text\n([\s\S]*?)```/g)].map((match) => match[1].trim());
  assert.equal(blocks.length, 2);
  const input = blocks[0].split(/\s+/).map(Number);
  let cursor = 1;
  const expected = [];
  for (let t = 0; t < input[0]; t++) {
    const n = input[cursor++];
    const a = input.slice(cursor, (cursor += n));
    const b = input.slice(cursor, (cursor += n));
    expected.push(oracle(a, b));
  }
  assert.equal(cursor, input.length);
  assert.deepEqual(blocks[1].split(/\s+/).map(Number), expected);
});

test('completed demo transcripts show illustrative learning results despite parsing issues; live still awaits review', async () => {
  const a = fixtureAttempt();
  a.uploads.learning = await validateUpload(
    'learning.txt',
    Buffer.from('A conversation without speaker labels.'),
    'learning',
    null,
  );
  a.uploads.learning.complete = true;
  assert.equal(a.uploads.learning.parseStatus, 'needs_review');
  const demo = await gradeTranscript(a, 'learning', '');
  assert(demo.every((o) => o.status === 'scored' && o.model === 'demo'));
  const report = calculateReport(a, demo, { verdict: 'Pending', criteria: [], checks: {} });
  assert(report.views!.learning.capabilities.some((c) => c.practical !== null));
  a.mode = 'live';
  const live = await gradeTranscript(a, 'learning', '');
  assert(live.every((o) => o.status === 'pending' && o.score === null));
  a.mode = 'demo';
  a.uploads.learning.complete = false;
  assert((await gradeTranscript(a, 'learning', '')).every((o) => o.status === 'pending'));
});

test('live transcripts with unavailable media reach Jev, including uploads saved for review earlier', async () => {
  const a = fixtureAttempt();
  a.mode = 'live';
  a.uploads.learning = await validateUpload(
    'learning.json',
    Buffer.from(
      JSON.stringify({
        messages: [
          {
            role: 'user',
            content: { parts: ['Explain this.', { content_type: 'image_asset_pointer' }] },
          },
          { role: 'assistant', content: 'It shows memory systems.' },
        ],
      }),
    ),
    'learning',
    null,
  );
  a.uploads.learning.complete = true;
  const fetchBefore = globalThis.fetch,
    keyBefore = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = 'synthetic';
  const sent: any[] = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    sent.push(body);
    return Response.json({
      model: 'jev-test',
      answers: Object.fromEntries(
        Object.keys(body.questions).map((id) => [id, { type: 'noul', noul: 0.8 }]),
      ),
    });
  };
  try {
    assert.equal(a.uploads.learning.parseStatus, 'ready');
    assert((await gradeTranscript(a, 'learning', '')).every((o) => o.status === 'scored'));
    assert.match(sent[0].state.transcript[0].text, /Non-text message content unavailable/);
    a.uploads.learning.parseStatus = 'needs_review';
    assert((await gradeTranscript(a, 'learning', '')).every((o) => o.status === 'scored'));
    assert.equal(sent.length, 2);
  } finally {
    globalThis.fetch = fetchBefore;
    if (keyBefore === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = keyBefore;
  }
});
