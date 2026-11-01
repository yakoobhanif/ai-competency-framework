import test from 'node:test';
import assert from 'node:assert/strict';
import { publicContent } from '../server/content.js';
import { shuffledQuizOrder, initializeQuizOrder } from '../server/quiz-order.js';
import { orderedQuizQuestions } from '../shared/quiz-order.js';
import {
  createAttempt,
  getAttempt,
  fromToken,
  saveAttempt,
  deleteAttempt,
} from '../server/store.js';
import { calculateReport } from '../server/scoring.js';
import { fixtureAttempt } from './fixtures.js';

const ids = publicContent.quiz.map((q) => q.id);

test('shuffle includes every question exactly once and supports all positions', () => {
  const bounds: number[] = [];
  const order = shuffledQuizOrder((max) => {
    bounds.push(max);
    return 0;
  });
  assert.deepEqual(
    bounds,
    Array.from({ length: ids.length - 1 }, (_, i) => ids.length - i),
  );
  assert.deepEqual([...order].sort(), [...ids].sort());
  assert.notDeepEqual(order, ids);
  assert.deepEqual(
    publicContent.quiz.map((q) => q.id),
    ids,
  );
  assert.deepEqual(
    orderedQuizQuestions(publicContent.quiz, order).map((q) => q.id),
    order,
  );
  assert.deepEqual(orderedQuizQuestions(publicContent.quiz), publicContent.quiz);
});

test('new assessments save a complete order that survives loading and stage transitions', () => {
  for (const mode of ['demo', 'live'] as const) {
    const { attempt, token } = createAttempt('Shuffle test', mode);
    try {
      const order = [...attempt.quizOrder!];
      assert.deepEqual([...order].sort(), [...ids].sort());
      assert.deepEqual(fromToken(token)!.quizOrder, order);
      attempt.stage = 'quiz';
      attempt.stageStarted.quiz = new Date().toISOString();
      attempt.quiz[order[0]] = 'B';
      attempt.cursor.quiz = 1;
      saveAttempt(attempt);
      assert.deepEqual(getAttempt(attempt.id)!.quizOrder, order);
      assert.equal(fromToken(token)!.quiz[order[0]], 'B');
      initializeQuizOrder(attempt);
      assert.deepEqual(attempt.quizOrder, order);
    } finally {
      deleteAttempt(attempt);
    }
  }
});

test('shuffled response order preserves every capability score and results profile', () => {
  const original = fixtureAttempt();
  const shuffled = structuredClone(original);
  shuffled.quizOrder = shuffledQuizOrder(() => 0);
  shuffled.quiz = Object.fromEntries(shuffled.quizOrder.map((id) => [id, original.quiz[id]]));
  const pass = { verdict: 'Pass' as const, criteria: [], checks: {} };
  const before = calculateReport(original, [], pass);
  const after = calculateReport(shuffled, [], pass);
  assert.deepEqual(after.capabilities, before.capabilities);
  assert.deepEqual(after.views, before.views);
});
