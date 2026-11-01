import type { Question } from './types.js';

// Positions are presentation only; answers and scoring always use the original IDs.
export function orderedQuizQuestions(questions: Question[], order?: string[]): Question[] {
  if (!order || order.length !== questions.length || new Set(order).size !== questions.length)
    return questions;
  const byId = new Map(questions.map((q) => [q.id, q]));
  if (order.some((id) => !byId.has(id))) return questions;
  return order.map((id) => byId.get(id)!);
}
