import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateReport } from '../server/scoring.js';
import { quizKey } from '../server/content.js';
import { fixtureAttempt, observations, essayDocx, transcript } from './fixtures.js';
import { populateSummaries, summaryContext, summaryKeys } from '../server/summaries.js';
import { resultStory } from '../shared/result-story.js';
import { validateUpload } from '../server/evidence.js';
const pass = { verdict: 'Pass' as const, criteria: [], checks: {} };

test('boosts use an inclusive threshold, available headroom and per-capability maximum', () => {
  const a = fixtureAttempt();
  const obs = observations();
  for (const o of obs) o.score = 0;
  const set = (id: string, task: string, p: number) => {
    obs.find((o) => o.capability === id && o.task === task)!.score = p;
  };
  set('L1', 'learning', 0.7);
  set('L1', 'creation', 0.9);
  set('L2', 'learning', 0.69999);
  set('L2', 'creation', 0.1);
  set('L3', 'learning', 1);
  set('L4', 'creation', 0.8);
  set('R5', 'learning', 0);
  set('R5', 'creation', 1);
  const report = calculateReport(a, obs, pass);
  const value = (view: 'quiz' | 'learning' | 'creation' | 'both', cap: string) =>
    report.views![view].capabilities.find((c) => c.id === cap)!;
  assert.equal(value('learning', 'L1').score, 35);
  assert.equal(value('creation', 'L1').score, 45);
  assert.equal(value('both', 'L1').score, 45);
  assert.equal(value('both', 'L2').score, 0);
  assert.equal(value('both', 'L3').score, 50);
  assert.equal(value('both', 'L4').score, 40);
  assert.equal(report.views!.both.dimensions.find((d) => d.id === 'L')!.score, (45 + 50 + 40) / 4);
  for (const view of Object.values(report.views!)) {
    assert.equal(value(view.id, 'R5').score, 100);
    for (const row of view.capabilities) {
      assert(row.score! >= row.quiz!);
      assert(row.score! <= 100);
    }
  }
  a.self = Object.fromEntries(Object.keys(a.self).map((id) => [id, 5]));
  assert.deepEqual(
    calculateReport(a, obs, pass).views!.both.capabilities,
    report.views!.both.capabilities,
  );
});
test('C5 is binary, creation-only, and unavailable grading preserves the baseline', () => {
  const a = fixtureAttempt();
  for (const verdict of ['Pass', 'Fail', 'Pending'] as const) {
    const r = calculateReport(a, [], { ...pass, verdict });
    assert.equal(r.views!.learning.capabilities.find((c) => c.id === 'C5')!.score, 0);
    assert.equal(
      r.views!.both.capabilities.find((c) => c.id === 'C5')!.score,
      verdict === 'Pass' ? 50 : 0,
    );
    assert.equal(
      r.views!.creation.capabilities.find((c) => c.id === 'C5')!.practical,
      verdict === 'Pass' ? 1 : verdict === 'Fail' ? 0 : null,
    );
  }
  a.quiz.Q18 = Object.entries(quizKey.Q18.points).find(([, p]) => p === 1)![0] as 'A';
  assert.equal(
    calculateReport(a, [], { ...pass, verdict: 'Fail' }).capabilities.find((c) => c.id === 'C5')!
      .score,
    100,
  );
});
test('unknown quiz values remain unknown and dimensions retain their full denominator', () => {
  const a = fixtureAttempt();
  for (const id of ['Q05', 'Q06', 'Q07', 'Q08', 'Q09']) delete a.quiz[id];
  assert.equal(calculateReport(a, observations(), pass).views!.both.dimensions[0].score, null);
  a.quiz.Q05 = 'not_sure';
  a.quiz.Q06 = 'not_sure';
  a.quiz.Q07 = 'not_sure';
  a.quiz.Q08 = 'not_sure';
  const r = calculateReport(a, observations(), pass);
  assert.equal(r.capabilities.find((c) => c.id === 'U9')!.score, null);
  assert.equal(
    r.views!.both.dimensions[0].score,
    r.capabilities.filter((c) => c.domain === 'U').reduce((sum, c) => sum + (c.score ?? 0), 0) / 9,
  );
});
test('DOCX conversations preserve author headings', async () => {
  const upload = await validateUpload('study.docx', await essayDocx(transcript), 'learning', null);
  assert.equal(upload.parseStatus, 'ready');
  assert.equal(upload.turns.filter((t) => t.role === 'student').length, 4);
});
test('Claude receives exactly the visible numeric evidence, never transcripts or hidden tasks', async () => {
  const a = fixtureAttempt();
  a.mode = 'live';
  a.uploads.learning = await validateUpload('study.txt', Buffer.from(transcript), 'learning', null);
  const report = calculateReport(a, observations(), pass);
  const previousFetch = globalThis.fetch,
    previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'synthetic';
  const calls: any[] = [];
  globalThis.fetch = async (_url, opts) => {
    const body = JSON.parse(String(opts?.body));
    calls.push(body);
    const context = JSON.parse(body.messages[0].content);
    assert.equal(context.capabilities.length, 25);
    assert(!body.messages[0].content.includes('My first attempt'));
    assert(!body.messages[0].content.includes('transcript'));
    const chapter = resultStory.find((c) => c.key === context.view)!;
    for (const c of context.capabilities) {
      assert.equal('self_assessment' in c, chapter.self);
      assert.equal('learning' in c, chapter.view === 'learning' || chapter.view === 'both');
      assert.equal('creation' in c, chapter.view === 'creation' || chapter.view === 'both');
      assert(c.description);
      assert('points' in c.quiz);
    }
    return Response.json({
      model: 'claude-synthetic',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            paragraphs: Array.from(
              { length: context.paragraph_count },
              () =>
                'You show useful judgement in these scenarios. Practise checking your decisions independently.',
            ),
          }),
        },
      ],
    });
  };
  try {
    await populateSummaries(a, report, 'Name should never be sent');
    assert.equal(calls.length, 5);
    assert.deepEqual(
      summaryKeys.map((k) => report.summaries![k]!.paragraphs.length),
      [2, 1, 2, 2, 2],
    );
    assert(summaryKeys.every((k) => report.summaries![k]?.source === 'llm'));
    await populateSummaries(a, report, '');
    assert.equal(calls.length, 5);
    // Only the failed view should be retried.
    report.summaries!['creation-self']!.source = 'fallback';
    await populateSummaries(a, report, '');
    assert.equal(calls.length, 6);
    assert.equal(JSON.parse(calls.at(-1).messages[0].content).view, 'creation-self');
    assert(!('self_assessment' in summaryContext(a, report, 'quiz').capabilities[0]));
    const fail = calculateReport(a, observations(), pass);
    globalThis.fetch = async () => Response.json({ error: 'test' }, { status: 429 });
    await populateSummaries(a, fail, '');
    assert.equal(fail.diagnostics?.length, 5);
    assert.equal(fail.commentary?.status, 'complete');
    assert(summaryKeys.every((k) => fail.summaries![k]?.source === 'fallback'));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
});

test('invalid paragraph counts retry only their view, then preserve a safe fallback', async () => {
  const a = fixtureAttempt();
  a.mode = 'live';
  const report = calculateReport(a, observations(), pass);
  const previousFetch = globalThis.fetch,
    previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'synthetic';
  const calls: Record<string, number> = {};
  globalThis.fetch = async (_url, opts) => {
    const body = JSON.parse(String(opts?.body));
    const context = JSON.parse(body.messages[0].content);
    const count = (calls[context.view] = (calls[context.view] || 0) + 1);
    // The provider does not support exact array lengths in its schema.
    const arraySchema = body.output_config.format.schema.properties.paragraphs;
    assert.equal(arraySchema.minItems, 1);
    assert.equal(arraySchema.maxItems, undefined);
    const paragraphs =
      context.view === 'quiz-self' && count === 1
        ? ['First.', 'Second.']
        : Array(context.paragraph_count).fill(
            'You can practise checking assumptions. Compare your reasoning with an independent source.',
          );
    return Response.json({ content: [{ type: 'text', text: JSON.stringify({ paragraphs }) }] });
  };
  try {
    await populateSummaries(a, report, '');
    assert.equal(calls['quiz-self'], 2);
    assert.equal(
      Object.values(calls).reduce((sum, n) => sum + n, 0),
      6,
    );
    assert.equal(report.summaries!['quiz-self']!.paragraphs.length, 1);
    assert.equal(report.commentary!.completed, 5);
    assert(summaryKeys.every((key) => report.summaries![key]!.source === 'llm'));
    globalThis.fetch = async () =>
      Response.json({ content: [{ type: 'text', text: '{"paragraphs":["Score 99."]}' }] });
    const invalid = calculateReport(a, observations(), pass);
    await populateSummaries(a, invalid, '');
    assert(summaryKeys.every((key) => invalid.summaries![key]!.source === 'fallback'));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
});
