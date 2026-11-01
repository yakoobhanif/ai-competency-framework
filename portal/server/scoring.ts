import { capabilities, quizKey } from './content.js';
import type { Attempt, Deliverable, Observation, Report } from '../shared/types.js';
import { SCORING_VERSION } from './prompts.js';
import { buildProfiles } from './profiles.js';

export function quizScores(answers: Attempt['quiz']) {
  const scores: Record<
    string,
    { earned: number; max: number; value: number | null; missing: boolean }
  > = {};
  for (const [id, key] of Object.entries(quizKey)) {
    const s = (scores[key.capability] ||= { earned: 0, max: 0, value: 0, missing: false });
    if (!Object.hasOwn(answers, id)) s.missing = true;
    s.earned += key.points[answers[id]] ?? 0;
    s.max += key.max;
    s.value = s.missing ? null : (s.earned / s.max) * 100;
  }
  return scores;
}
export function calculateReport(
  attempt: Attempt,
  observations: Observation[],
  deliverable: Deliverable,
): Report {
  const q = quizScores(attempt.quiz);
  const views = buildProfiles(attempt, q, observations, deliverable);
  const results = capabilities.map((c) => {
    const row = views.both.capabilities.find((v) => v.id === c.id)!;
    const quiz = q[c.id]?.value ?? null;
    return {
      ...c,
      score: row.score,
      quiz,
      self: typeof attempt.self[c.id] === 'number' ? (attempt.self[c.id] as number) : null,
      adjustment: quiz !== null && row.score !== null ? row.score - quiz : null,
      observations: observations.filter((o) => o.capability === c.id),
    };
  });
  return {
    mode: attempt.mode,
    version: SCORING_VERSION,
    createdAt: new Date().toISOString(),
    pathway: attempt.pathway!,
    capabilities: results,
    deliverable,
    feedback: { paragraphs: [], source: 'fallback' },
    views,
    audit: attempt.report?.audit ?? [],
  };
}
