import { z } from 'zod';
import { capabilities, publicContent, deliverableRubrics } from './content.js';
import { redact } from './evidence.js';
import { collectSources } from './sources.js';
import { runCode } from './code-runner.js';
import { ESSAY_MASTER, TRANSCRIPT_MASTER, jevModel } from './prompts.js';
import type { Attempt, Observation, Deliverable } from '../shared/types.js';

export type NoulQuestion = {
  type: 'noul';
  instructions: Record<string, unknown>;
  criteria: { true: string; false: string };
};
export const transcriptCapabilities = capabilities.filter((c) => c.id !== 'C5');
export const capabilityDefinitions = capabilities.map(({ id, name, description }) => ({
  id,
  name,
  description,
}));
const answerSchema = z.object({ type: z.literal('noul'), noul: z.number().finite().min(0).max(1) });
export async function jev(state: string | object, questions: Record<string, NoulQuestion>) {
  if (!process.env.TYPESAFE_API_KEY) throw new Error('Live grading needs TYPESAFE_API_KEY.');
  if (JSON.stringify({ state, questions }).length > 500000)
    throw new Error('Submission exceeds the configured context budget; no content was truncated.');
  let response: Response | undefined;
  for (let retry = 0; retry < 3; retry++) {
    response = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      signal: AbortSignal.timeout(90000),
      headers: {
        authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
        'content-type': 'application/json',
        ...(JSON.stringify(state).length > 40000 ||
        JSON.stringify({ state, questions }).length > 120000
          ? { 'TypeSafe-Danger-Zone-Long-Context': 'true' }
          : {}),
      },
      body: JSON.stringify({ model: jevModel(), state, questions }),
    });
    if (response.ok || (response.status !== 429 && response.status < 500)) break;
    await response.body?.cancel();
    if (retry < 2) await new Promise((resolve) => setTimeout(resolve, 700 * (retry + 1)));
  }
  if (!response?.ok)
    throw new Error(`Jev evaluation unavailable (HTTP ${response?.status ?? 'unavailable'}).`);
  const parsed = z
    .object({ model: z.string(), answers: z.record(z.string(), answerSchema) })
    .parse(await response.json());
  if (
    Object.keys(parsed.answers).length !== Object.keys(questions).length ||
    Object.keys(questions).some((id) => !parsed.answers[id])
  )
    throw new Error('Jev returned an incomplete or unexpected set of decisions.');
  return parsed;
}

export function unscoredTranscript(
  task: 'learning' | 'creation',
  status: 'absent' | 'pending',
  reason: string,
): Observation[] {
  return transcriptCapabilities.map((c) => ({
    capability: c.id,
    task,
    status,
    score: null,
    reason,
  }));
}
export async function gradeTranscript(
  a: Attempt,
  task: 'learning' | 'creation',
  name: string,
  deliverable?: Deliverable,
): Promise<Observation[]> {
  const upload = a.uploads[task];
  if (!upload) throw new Error('Transcript is missing.');
  if (upload.kind === 'no_ai')
    return unscoredTranscript(
      task,
      'absent',
      'The student reported working without AI; the quiz baseline is retained.',
    );
  // Demo probabilities illustrate the flow; they do not assess transcript content.
  if (a.mode === 'demo' && upload.complete)
    return transcriptCapabilities.map((c, i) => ({
      capability: c.id,
      task,
      status: 'scored',
      score: [0.85, 0.4, 0.75, 0.6][(i + (task === 'creation' ? 1 : 0)) % 4],
      reason: 'Illustrative demo probability; this transcript has not been evaluated by AI.',
      model: 'demo',
    }));
  if (
    upload.parseStatus === 'needs_review' ||
    !upload.complete ||
    !upload.turns.some((t) => t.role === 'student')
  )
    return unscoredTranscript(
      task,
      'pending',
      'Conversation authorship or completeness needs review; no roles were guessed.',
    );
  const state = {
    purpose:
      'Identify AI capabilities demonstrated by a university student in a practical assessment.',
    task:
      task === 'learning'
        ? {
            summary:
              'The student studies memory and attention using AI, then submits their complete conversation.',
            concepts: [
              'memory systems',
              'attention',
              'working memory and chunking',
              'encoding and retrieval',
              'forgetting and memory distortion',
              'study strategies',
            ],
          }
        : {
            summary:
              a.pathway === 'essay'
                ? 'Use AI to write an essay about how recommendation algorithms learn and shape preferences.'
                : 'Use AI to solve a programming problem in Python.',
            assignment: publicContent.briefs[a.pathway!],
            ...(a.pathway === 'coding'
              ? { problem: publicContent.codingProblem }
              : { rubric: deliverableRubrics.essay }),
          },
    capabilities: capabilityDefinitions,
    transcript: upload.turns.map((t) => ({ ...t, text: redact(t.text, name) })),
    ...(task === 'creation'
      ? {
          finalArtifact: redact(a.uploads.deliverable!.text, name),
          deliverable: { verdict: deliverable?.verdict ?? 'Pending' },
        }
      : {}),
  };
  const questions = Object.fromEntries(
    transcriptCapabilities.map((c) => [
      c.id,
      {
        type: 'noul' as const,
        instructions: {
          role: TRANSCRIPT_MASTER,
          target_capability: capabilityDefinitions.find((d) => d.id === c.id),
          question: "Does the student's contribution demonstrate this capability in this task?",
        },
        criteria: {
          true: "The student's contribution provides clear, task-relevant evidence of this capability.",
          false:
            'The conversation does not establish that the student demonstrates this capability.',
        },
      },
    ]),
  );
  const result = await jev(state, questions);
  return transcriptCapabilities.map((c) => ({
    capability: c.id,
    task,
    status: 'scored',
    score: result.answers[c.id].noul,
    reason:
      'NOUL probability of demonstrated capability; values below the evidence threshold add no credit.',
    model: result.model,
    raw: result.answers[c.id],
  }));
}

export function essayPass(probabilities: number[]) {
  if (
    probabilities.length !== 5 ||
    probabilities.some((p) => !Number.isFinite(p) || p < 0 || p > 1)
  )
    throw new Error('Five valid essay criterion probabilities are required.');
  return probabilities.every((p) => p >= 0.5) && probabilities.filter((p) => p >= 0.7).length >= 3;
}
export async function gradeDeliverable(a: Attempt, name: string): Promise<Deliverable> {
  const upload = a.uploads.deliverable!;
  if (a.pathway === 'coding') {
    const code = await runCode(upload.text);
    return {
      verdict: code.status,
      criteria: [
        { id: 'tests', label: 'Hidden test cases', verdict: code.status, reason: code.detail },
      ],
      checks: { code, model: 'deterministic' },
    };
  }
  const sources = a.mode === 'live' ? await collectSources(upload.text) : [];
  const checks = { words: upload.words, sources, model: a.mode === 'demo' ? 'demo' : jevModel() };
  const questions = Object.fromEntries(
    deliverableRubrics.essay.map(([id, label, requirement]) => [
      id,
      {
        type: 'noul' as const,
        instructions: {
          role: ESSAY_MASTER,
          criterion: { name: label, requirement },
          question: 'Does the essay meet this criterion?',
        },
        criteria: {
          true: 'The essay meets the requirement.',
          false: 'The essay does not meet the requirement.',
        },
      },
    ]),
  );
  const result =
    a.mode === 'demo'
      ? null
      : await jev(
          {
            assignment: publicContent.briefs.essay,
            essay: redact(upload.text, name),
            wordCount: upload.words,
            sourceChecks: sources,
          },
          questions,
        );
  if (result) checks.model = result.model;
  const criteria = deliverableRubrics.essay.map(([id, label]) => {
    const probability = result?.answers[id].noul ?? 0.85;
    return {
      id,
      label,
      probability,
      verdict: probability >= 0.7 ? ('Pass' as const) : ('Fail' as const),
      reason:
        a.mode === 'demo'
          ? 'Illustrative demo probability.'
          : 'NOUL probability that the published criterion is met.',
      raw: result?.answers[id],
    };
  });
  return {
    verdict: essayPass(criteria.map((c) => c.probability)) ? 'Pass' : 'Fail',
    criteria,
    checks: { ...checks, rule: 'At least three criteria >= 0.70 and all five >= 0.50.' },
  };
}
