import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAttempt,
  getAttempt,
  saveAttempt,
  deleteAttempt,
  saveOriginal,
} from '../server/store.js';
import { assessLearning, evaluate } from '../server/worker.js';
import { validateUpload } from '../server/evidence.js';
import { fixtureAttempt, transcript, essayDocx } from './fixtures.js';

test('learning runs early, successful stages cache across reloads/retries, and artifact precedes creation', async () => {
  const { attempt } = createAttempt('Synthetic cache check', 'live');
  const previousFetch = globalThis.fetch,
    jevKey = process.env.TYPESAFE_API_KEY,
    claudeKey = process.env.ANTHROPIC_API_KEY;
  process.env.TYPESAFE_API_KEY = 'synthetic';
  delete process.env.ANTHROPIC_API_KEY;
  const calls: string[] = [];
  let failCreation = true;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    const stage = body.state.essay
      ? 'artifact'
      : body.state.finalArtifact
        ? 'creation'
        : 'learning';
    calls.push(stage);
    if (stage === 'creation' && failCreation) return Response.json({}, { status: 400 });
    if (stage === 'creation') assert.equal(body.state.deliverable.verdict, 'Pass');
    return Response.json({
      model: 'jev-test',
      answers: Object.fromEntries(
        Object.keys(body.questions).map((id) => [id, { type: 'noul', noul: 0.9 }]),
      ),
    });
  };
  try {
    attempt.stage = 'choice';
    attempt.pathway = 'essay';
    attempt.self = fixtureAttempt().self;
    attempt.quiz = fixtureAttempt().quiz;
    attempt.uploads.learning = await validateUpload(
      'study.txt',
      Buffer.from(transcript),
      'learning',
      null,
    );
    attempt.uploads.learning.complete = true;
    saveAttempt(attempt);
    await Promise.all([assessLearning(attempt.id), assessLearning(attempt.id)]);
    assert.deepEqual(calls, ['learning']);
    assert.equal(getAttempt(attempt.id)!.stage, 'choice');
    assert.equal(getAttempt(attempt.id)!.assessments!.learning!.result.length, 24);
    await assessLearning(attempt.id);
    assert.equal(calls.length, 1);
    const fresh = getAttempt(attempt.id)!;
    fresh.stage = 'processing';
    fresh.job.status = 'running';
    fresh.uploads.creation = await validateUpload(
      'create.txt',
      Buffer.from(transcript),
      'creation',
      'essay',
    );
    fresh.uploads.creation.complete = true;
    const outputBytes = await essayDocx('An essay.\nReferences\nA book.');
    fresh.uploads.deliverable = await validateUpload(
      'essay.docx',
      outputBytes,
      'deliverable',
      'essay',
    );
    saveOriginal(fresh, fresh.uploads.deliverable.id, outputBytes);
    saveAttempt(fresh);
    await evaluate(fresh.id);
    let done = getAttempt(fresh.id)!;
    assert.deepEqual(calls, ['learning', 'artifact', 'creation']);
    assert(
      done
        .report!.capabilities.filter((c) => c.id !== 'C5')
        .every((c) => c.observations.find((o) => o.task === 'creation')?.status === 'pending'),
    );
    assert.equal(done.report!.deliverable.verdict, 'Pass');
    failCreation = false;
    await evaluate(fresh.id);
    assert.deepEqual(calls, ['learning', 'artifact', 'creation', 'creation']);
    done = getAttempt(fresh.id)!;
    assert.equal(done.job.status, 'complete');
    assert.equal(done.report!.version, 'pilot-3.0-noul-boost');
    await evaluate(fresh.id);
    assert.equal(calls.length, 4);
    // A changed creation transcript invalidates only that stage.
    done = getAttempt(fresh.id)!;
    done.uploads.creation!.turns[0].text += ' A revised request.';
    saveAttempt(done);
    await evaluate(fresh.id);
    assert.deepEqual(calls, ['learning', 'artifact', 'creation', 'creation', 'creation']);
  } finally {
    globalThis.fetch = previousFetch;
    if (jevKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = jevKey;
    if (claudeKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = claudeKey;
    deleteAttempt(getAttempt(attempt.id) ?? attempt);
  }
});
