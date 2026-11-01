import test from 'node:test';
import assert from 'node:assert/strict';
import { jev, gradeTranscript, gradeDeliverable, essayPass } from '../server/providers.js';
import { fixtureAttempt, transcript, essayDocx } from './fixtures.js';
import { validateUpload } from '../server/evidence.js';
import { TRANSCRIPT_MASTER, ESSAY_MASTER } from '../server/prompts.js';

const question = {
  test: {
    type: 'noul' as const,
    instructions: { question: 'Does it demonstrate the target?' },
    criteria: { true: 'Yes', false: 'No' },
  },
};
test('NOUL validates complete probability responses, including boundary values', async () => {
  const fetchBefore = globalThis.fetch,
    keyBefore = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = 'synthetic';
  let answers: unknown = { test: { type: 'noul', noul: 1 } };
  globalThis.fetch = async () => Response.json({ model: 'jev-test', answers });
  try {
    assert.equal((await jev({}, question)).answers.test.noul, 1);
    answers = { test: { type: 'noul', noul: 0 } };
    await jev({}, question);
    for (const invalid of [
      {},
      { wrong: { type: 'noul', noul: 0.7 } },
      { test: { type: 'noul', noul: 1.01 } },
      { test: { type: 'score', score: 2 } },
      { test: { type: 'noul', noul: null } },
    ]) {
      answers = invalid;
      await assert.rejects(jev({}, question));
    }
  } finally {
    globalThis.fetch = fetchBefore;
    if (keyBefore === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = keyBefore;
  }
});
test('one transcript call assesses 24 capabilities, excludes C5 and keeps tasks independent', async () => {
  const fetchBefore = globalThis.fetch,
    keyBefore = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = 'synthetic';
  const bodies: any[] = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    bodies.push(body);
    return Response.json({
      model: 'jev-test',
      answers: Object.fromEntries(
        Object.keys(body.questions).map((id) => [id, { type: 'noul', noul: 0.91 }]),
      ),
    });
  };
  try {
    const a = fixtureAttempt();
    a.mode = 'live';
    a.uploads.learning = await validateUpload(
      'study.txt',
      Buffer.from(transcript.replace('I want', 'I am Alex Example and I want')),
      'learning',
      null,
    );
    a.uploads.learning.complete = true;
    a.uploads.creation = { ...a.uploads.learning };
    a.uploads.deliverable = await validateUpload(
      'essay.docx',
      await essayDocx(),
      'deliverable',
      'essay',
    );
    const learning = await gradeTranscript(a, 'learning', 'Alex Example');
    assert.equal(bodies.length, 1);
    assert.equal(learning.length, 24);
    assert(learning.every((o) => o.score === 0.91 && o.status === 'scored'));
    assert.equal(Object.keys(bodies[0].questions).length, 24);
    assert(!bodies[0].questions.C5);
    assert(bodies[0].questions.U1);
    assert.equal(bodies[0].questions.L1.instructions.role, TRANSCRIPT_MASTER);
    assert.equal(bodies[0].state.capabilities.length, 25);
    assert(!JSON.stringify(bodies[0]).includes('Alex Example'));
    assert(!('reference' in bodies[0].state));
    assert(!('slides' in bodies[0].state));
    assert(!('finalArtifact' in bodies[0].state));
    const verdict = { verdict: 'Pass' as const, criteria: [], checks: {} };
    await gradeTranscript(a, 'creation', 'Alex Example', verdict);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[1].state.deliverable.verdict, 'Pass');
    assert(bodies[1].state.finalArtifact.includes('Recommendation'));
    assert(!('learning' in bodies[1].state));
    assert(!('quiz' in bodies[1].state));
    assert(!('self' in bodies[1].state));
    a.pathway = 'coding';
    await gradeTranscript(a, 'creation', '', verdict);
    assert(bodies[2].state.task.problem.includes('Input'));
  } finally {
    globalThis.fetch = fetchBefore;
    if (keyBefore === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = keyBefore;
  }
});
test('essay decisions use exactly the approved inclusive thresholds', () => {
  assert(essayPass([0.7, 0.7, 0.7, 0.5, 0.5]));
  assert(essayPass([1, 1, 1, 1, 1]));
  assert(!essayPass([0.7, 0.7, 0.69999, 0.6, 0.6]));
  assert(!essayPass([1, 1, 1, 1, 0.49999]));
  assert.throws(() => essayPass([1, 1, 1, 1]));
  assert.throws(() => essayPass([1, 1, 1, 1, NaN]));
});
test('essay sends full text and five simple NOUL questions without extra pass gates', async () => {
  const fetchBefore = globalThis.fetch,
    keyBefore = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = 'synthetic';
  let body: any;
  globalThis.fetch = async (_url, opts) => {
    body = JSON.parse(String(opts?.body));
    return Response.json({
      model: 'jev-test',
      answers: Object.fromEntries(
        Object.keys(body.questions).map((id, i) => [id, { type: 'noul', noul: i < 3 ? 0.7 : 0.5 }]),
      ),
    });
  };
  try {
    const a = fixtureAttempt();
    a.mode = 'live';
    // No sources are available; their absence must not create an extra Pending gate.
    a.uploads.deliverable = await validateUpload(
      'essay.docx',
      await essayDocx('A full essay.\nReferences\nAn identifiable book.'),
      'deliverable',
      'essay',
    );
    a.uploads.deliverable.words = 1001;
    const result = await gradeDeliverable(a, '');
    assert.equal(result.verdict, 'Pass');
    assert.equal(Object.keys(body.questions).length, 5);
    assert(
      Object.values(body.questions).every(
        (q: any) => q.type === 'noul' && q.instructions.role === ESSAY_MASTER,
      ),
    );
    assert.equal(body.state.wordCount, 1001);
    assert(body.state.essay.includes('References'));
    assert.equal(result.checks.model, 'jev-test');
  } finally {
    globalThis.fetch = fetchBefore;
    if (keyBefore === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = keyBefore;
  }
});
