import { createHash } from 'node:crypto';
import { z } from 'zod';
import { capabilities } from './content.js';
import { quizScores } from './scoring.js';
import { resultStory } from '../shared/result-story.js';
import { CLAUDE_MASTER, commentaryModel, SUMMARY_VERSION } from './prompts.js';
import { summaryFallback } from '../shared/result-feedback.js';
export { summaryFallback } from '../shared/result-feedback.js';
import type { Attempt, Report, SummaryKey } from '../shared/types.js';

export const summaryKeys = resultStory.map((chapter) => chapter.key);
export function summaryContext(attempt: Attempt, report: Report, key: SummaryKey) {
  const chapter = resultStory.find((c) => c.key === key)!;
  const quiz = quizScores(attempt.quiz);
  const selectedTasks =
    chapter.view === 'quiz'
      ? []
      : chapter.view === 'both'
        ? ['learning', 'creation']
        : [chapter.view];
  return {
    view: key,
    paragraph_count: chapter.paragraphs,
    format_instruction: `Write exactly ${chapter.paragraphs === 1 ? 'one paragraph' : 'two paragraphs'}, with two or three short sentences in each.`,
    focus: chapter.focus,
    capabilities: capabilities.map(({ id, name, description }) => {
      const row = report.capabilities.find((c) => c.id === id)!;
      return {
        id,
        name,
        description,
        quiz: {
          points: quiz[id]?.missing ? null : (quiz[id]?.earned ?? null),
          maximum: quiz[id]?.max ?? null,
        },
        ...(chapter.self ? { self_assessment: { rating: row.self, scale: '1–5' } } : {}),
        ...Object.fromEntries(
          selectedTasks.map((task) => {
            const view = report.views![task as 'learning' | 'creation'].capabilities.find(
              (c) => c.id === id,
            )!;
            const observation = row.observations.find((o) => o.task === task);
            return [
              task,
              id === 'C5'
                ? {
                    ...(task === 'creation'
                      ? {
                          artifact_pass:
                            report.deliverable.verdict === 'Pending'
                              ? null
                              : report.deliverable.verdict === 'Pass',
                          binary_evidence: view.practical,
                        }
                      : { assessed: false }),
                    contribution: view.adjustment,
                  }
                : {
                    evidence_probability:
                      observation?.status === 'scored' ? observation.score : null,
                    contribution: view.adjustment,
                    status: observation?.status ?? 'absent',
                  },
            ];
          }),
        ),
      };
    }),
    dimension_results: report.views![chapter.view].dimensions.map(({ id, name, score }) => ({
      id,
      name,
      score,
    })),
  };
}
export function initializeSummaries(report: Report) {
  report.summaries = Object.fromEntries(
    summaryKeys.map((key) => [key, summaryFallback(report, key)]),
  );
  report.feedback = report.summaries.quiz!;
}
export async function populateSummaries(
  attempt: Attempt,
  report: Report,
  _name: string,
  onProgress?: () => void,
): Promise<void> {
  const contexts = Object.fromEntries(
    summaryKeys.map((key) => [key, summaryContext(attempt, report, key)]),
  );
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(contexts))
    .update(SUMMARY_VERSION)
    .update(commentaryModel())
    .digest('hex');
  if (report.summaryFingerprint !== fingerprint) initializeSummaries(report);
  report.summaryFingerprint = fingerprint;
  const completed = () =>
    summaryKeys.filter((key) => report.summaries?.[key]?.source === 'llm').length;
  report.commentary = { status: 'pending', completed: completed(), total: summaryKeys.length };
  if (attempt.mode === 'demo' || !process.env.ANTHROPIC_API_KEY) {
    report.commentary = {
      status: 'complete',
      completed: summaryKeys.length,
      total: summaryKeys.length,
    };
    if (attempt.mode === 'live')
      (report.diagnostics ||= []).push({
        component: 'commentary',
        code: 'missing_key',
        at: new Date().toISOString(),
      });
    onProgress?.();
    return;
  }
  await Promise.allSettled(
    resultStory.map(async (chapter) => {
      if (report.summaries?.[chapter.key]?.source === 'llm') return;
      for (let retry = 0; retry < 2; retry++) {
        try {
          const shape = {
            type: 'object',
            additionalProperties: false,
            properties: {
              paragraphs: {
                type: 'array',
                description: `Exactly ${chapter.paragraphs === 1 ? 'one paragraph' : 'two paragraphs'}.`,
                minItems: 1,
                items: { type: 'string' },
              },
            },
            required: ['paragraphs'],
          };
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            signal: AbortSignal.timeout(90000),
            headers: {
              'x-api-key': process.env.ANTHROPIC_API_KEY!,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: commentaryModel(),
              max_tokens: 1200,
              output_config: { format: { type: 'json_schema', schema: shape } },
              system: CLAUDE_MASTER,
              messages: [{ role: 'user', content: JSON.stringify(contexts[chapter.key]) }],
            }),
          });
          if (!response.ok) throw new Error(`HTTP_${response.status}`);
          const payload = (await response.json()) as {
            model?: string;
            stop_reason?: string;
            content: { type: string; text?: string }[];
          };
          if (payload.stop_reason === 'max_tokens' || payload.stop_reason === 'refusal')
            throw new Error(payload.stop_reason);
          const text = payload.content
            .filter((c) => c.type === 'text')
            .map((c) => c.text ?? '')
            .join('')
            .replace(/^```(?:json)?\s*|\s*```$/g, '');
          const parsed = z
            .object({
              paragraphs: z
                .array(
                  z
                    .string()
                    .trim()
                    .min(1)
                    .max(1800)
                    .refine((s) => !/[\r\n]/.test(s)),
                )
                .length(chapter.paragraphs),
            })
            .strict()
            .parse(JSON.parse(text));
          if (parsed.paragraphs.some((p) => /\d|%|\b[ULCR]\d\b/.test(p)))
            throw new Error('numeric_feedback');
          report.summaries![chapter.key] = {
            ...parsed,
            source: 'llm',
            model: payload.model || commentaryModel(),
          };
          break;
        } catch (error) {
          if (retry === 0 && error instanceof Error && !/HTTP_4(?!29)|refusal/.test(error.message))
            continue;
          (report.diagnostics ||= []).push({
            component: `summary:${chapter.key}`,
            code:
              error instanceof z.ZodError
                ? 'invalid_paragraphs'
                : error instanceof SyntaxError
                  ? 'invalid_json'
                  : error instanceof Error
                    ? error.message.slice(0, 100)
                    : 'provider_error',
            at: new Date().toISOString(),
          });
          break;
        }
      }
      report.commentary!.completed++;
      onProgress?.();
    }),
  );
  report.feedback = report.summaries!.quiz!;
  report.commentary.status = 'complete';
  onProgress?.();
}
