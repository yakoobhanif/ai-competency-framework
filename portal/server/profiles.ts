import { capabilities, domains } from './content.js';
import type {
  Attempt,
  Deliverable,
  Observation,
  Profile,
  ProfileView,
  SkillBand,
} from '../shared/types.js';

export const profileIds: ProfileView[] = ['quiz', 'learning', 'creation', 'both'];
export const minimumCoverage = 0.8;
export function skillBand(score: number | null): SkillBand {
  return score === null
    ? 'Insufficient evidence'
    : score < 50
      ? 'Developing'
      : score < 75
        ? 'Established'
        : 'Strong';
}

export function buildProfiles(
  attempt: Attempt,
  quiz: Record<string, { value: number | null }>,
  observations: Observation[],
  deliverable: Deliverable,
): Record<ProfileView, Profile> {
  return Object.fromEntries(
    profileIds.map((id) => {
      const selected = id === 'quiz' ? [] : id === 'both' ? ['learning', 'creation'] : [id];
      const values = capabilities.map((c) => {
        const q = quiz[c.id]?.value ?? null;
        const relevant = observations.filter(
          (o) => o.capability === c.id && selected.includes(o.task),
        );
        const eligible = relevant.filter(
          (o) =>
            o.status === 'scored' &&
            o.score !== null &&
            Number.isFinite(o.score) &&
            o.score >= 0 &&
            o.score <= 1,
        );
        let practical = eligible.length
          ? Math.max(...eligible.map((o) => (o.score! >= 0.7 ? o.score! : 0)))
          : null;
        let pending = relevant.some((o) => o.status === 'pending');
        if (c.id === 'C5') {
          practical =
            selected.includes('creation') && deliverable.verdict !== 'Pending'
              ? deliverable.verdict === 'Pass'
                ? 1
                : 0
              : null;
          pending = selected.includes('creation') && deliverable.verdict === 'Pending';
        }
        // Each task can only fill half of the remaining quiz headroom. Taking the
        // maximum per capability avoids counting overlapping evidence twice.
        const score = q === null ? null : q + 0.5 * (100 - q) * (practical ?? 0);
        return {
          id: c.id,
          score,
          quiz: q,
          practical,
          adjustment: q !== null && practical !== null ? score! - q : null,
          pending,
        };
      });
      const dimensions = domains.map((d) => {
        const items = values.filter((v) => v.id.startsWith(d.id));
        const scored = items.filter((v) => v.score !== null);
        const ratings = capabilities
          .filter((c) => c.domain === d.id)
          .map((c) => attempt.self[c.id])
          .filter((v): v is number => typeof v === 'number');
        const score =
          scored.length / items.length >= minimumCoverage
            ? scored.reduce((s, v) => s + v.score!, 0) / items.length
            : null;
        // Self-ratings are projected for visual comparison only; never enter performance formulas.
        const self =
          ratings.length / items.length >= minimumCoverage
            ? (ratings.reduce((s, n) => s + n, 0) / ratings.length - 1) * 25
            : null;
        return {
          ...d,
          score,
          self,
          band: skillBand(score),
          coverage: scored.length,
          count: items.length,
          pending: items.some((v) => v.pending),
          adjusted: items.filter((v) => (v.adjustment ?? 0) > 0).length,
        };
      });
      return [id, { id, capabilities: values, dimensions }];
    }),
  ) as Record<ProfileView, Profile>;
}
