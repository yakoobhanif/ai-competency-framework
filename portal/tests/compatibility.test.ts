import test from 'node:test';
import assert from 'node:assert/strict';
import { questionnaireFingerprint } from '../server/content.js';
import {
  createAttempt,
  getAttempt,
  fromToken,
  saveAttempt,
  saveOriginal,
  deleteAttempt,
} from '../server/store.js';
import { validateUpload } from '../server/evidence.js';
import { transcript, fixtureAttempt, essayDocx } from './fixtures.js';
import { evaluate } from '../server/worker.js';

test('existing learning submissions survive practical-material updates in both modes', async () => {
  for (const mode of ['demo', 'live'] as const) {
    const { attempt, token } = createAttempt('Compatibility regression', mode);
    try {
      attempt.stage = 'learning';
      attempt.versions.content = 'previous-slides-and-instructions';
      attempt.self.U1 = 4;
      attempt.quiz.Q01 = 'B';
      attempt.uploads.learning = await validateUpload(
        'study.txt',
        Buffer.from(transcript),
        'learning',
        null,
      );
      attempt.uploads.learning.complete = true;
      saveAttempt(attempt);
      const before = JSON.parse(JSON.stringify(attempt));
      const restored = fromToken(token)!;
      assert.equal(restored.versions.questionnaire, questionnaireFingerprint);
      assert.equal(restored.versions.content, before.versions.content);
      for (const key of ['self', 'quiz', 'quizOrder', 'uploads', 'cursor', 'stage'] as const)
        assert.deepEqual(restored[key], before[key]);
      assert.equal(getAttempt(attempt.id)!.versions.questionnaire, questionnaireFingerprint);
    } finally {
      deleteAttempt(attempt);
    }
  }
});

test('final evaluation also permits revised practical materials without losing questionnaire data', async () => {
  const { attempt } = createAttempt('Final evaluation compatibility', 'demo');
  try {
    attempt.stage = 'processing';
    attempt.pathway = 'essay';
    attempt.versions.content = 'earlier-practical-materials';
    attempt.self = fixtureAttempt().self;
    attempt.quiz = fixtureAttempt().quiz;
    attempt.uploads.learning = await validateUpload(
      'study.txt',
      Buffer.from(transcript),
      'learning',
      null,
    );
    attempt.uploads.creation = await validateUpload(
      'creation.txt',
      Buffer.from(transcript),
      'creation',
      'essay',
    );
    const outputBytes = await essayDocx();
    attempt.uploads.deliverable = await validateUpload(
      'essay.docx',
      outputBytes,
      'deliverable',
      'essay',
    );
    saveOriginal(attempt, attempt.uploads.deliverable.id, outputBytes);
    saveAttempt(attempt);
    await evaluate(attempt.id);
    const result = getAttempt(attempt.id)!;
    assert.equal(result.stage, 'results');
    assert.equal(result.job.status, 'complete');
    assert.deepEqual(result.quiz, attempt.quiz);
    assert.deepEqual(result.quizOrder, attempt.quizOrder);
    assert.equal(result.report?.deliverable.verdict, 'Pass');
  } finally {
    deleteAttempt(attempt);
  }
});
