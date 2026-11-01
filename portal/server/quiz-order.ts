import { randomInt } from 'node:crypto';
import type { Attempt } from '../shared/types.js';
import { publicContent } from './content.js';

export function shuffledQuizOrder(draw: (max: number) => number = randomInt): string[] {
  const order = publicContent.quiz.map((q) => q.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = draw(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function initializeQuizOrder(attempt: Attempt): void {
  attempt.quizOrder ??= shuffledQuizOrder();
}
