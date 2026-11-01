import path from 'node:path';
import { writeRunExport } from './run-exports.js';
import { createHash } from 'node:crypto';
import { getAttempt, nameOf, saveAttempt, archiveReport, dataDir } from './store.js';
import {
  gradeTranscript,
  gradeDeliverable,
  unscoredTranscript,
  capabilityDefinitions,
} from './providers.js';
import { populateSummaries } from './summaries.js';
import { calculateReport } from './scoring.js';
import { questionnaireFingerprint, publicContent, deliverableRubrics } from './content.js';
import {
  jevModel,
  PROMPT_VERSION,
  SCORING_VERSION,
  TRANSCRIPT_MASTER,
  ESSAY_MASTER,
} from './prompts.js';
import type { Attempt, AssessmentCache, Observation, Deliverable } from '../shared/types.js';

const running = new Set<string>();
const learningCalls = new Map<string, Promise<Observation[]>>();
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function inputHash(
  a: Attempt,
  task: 'learning' | 'creation' | 'deliverable',
  deliverable?: Deliverable,
) {
  return hash({
    task,
    mode: a.mode,
    ...(a.mode === 'demo' ? { demoVersion: 'illustrative-transcripts-2' } : {}),
    model:
      task === 'deliverable' && a.pathway === 'coding'
        ? 'deterministic-python-v2-force-timeout'
        : jevModel(),
    promptVersion: PROMPT_VERSION,
    scoring: SCORING_VERSION,
    master: task === 'deliverable' ? ESSAY_MASTER : TRANSCRIPT_MASTER,
    capabilities: capabilityDefinitions,
    upload: a.uploads[task],
    ...(task !== 'learning'
      ? {
          pathway: a.pathway,
          assignment: publicContent.briefs[a.pathway!],
          rubric: deliverableRubrics.essay,
          problem: a.pathway === 'coding' ? publicContent.codingProblem : undefined,
        }
      : {}),
    ...(task === 'creation' ? { artifact: a.uploads.deliverable, deliverable } : {}),
  });
}
function cache<T>(inputHash: string, result: T, model: string): AssessmentCache<T> {
  return {
    inputHash,
    result,
    completedAt: new Date().toISOString(),
    promptVersion: PROMPT_VERSION,
    model,
  };
}
export function assessLearning(id: string): Promise<Observation[]> {
  const existing = learningCalls.get(id);
  if (existing) return existing;
  const call = (async () => {
    const a = getAttempt(id);
    if (!a?.uploads.learning?.complete)
      return unscoredTranscript('learning', 'pending', 'Learning submission is incomplete.');
    const fingerprint = inputHash(a, 'learning');
    if (a.assessments?.learning?.inputHash === fingerprint) return a.assessments.learning.result;
    try {
      const result = await gradeTranscript(a, 'learning', nameOf(id));
      const fresh = getAttempt(id);
      if (
        fresh &&
        inputHash(fresh, 'learning') === fingerprint &&
        !result.some((o) => o.status === 'pending')
      ) {
        (fresh.assessments ||= {}).learning = cache(
          fingerprint,
          result,
          result.find((o) => o.model)?.model || 'not-assessed',
        );
        saveAttempt(fresh);
      }
      return result;
    } catch (error) {
      return unscoredTranscript(
        'learning',
        'pending',
        `Evaluation unavailable: ${error instanceof Error ? error.message : 'provider error'}. Quiz baseline retained.`,
      );
    }
  })();
  learningCalls.set(id, call);
  void call.finally(() => learningCalls.delete(id));
  return call;
}
export async function evaluate(id: string) {
  if (running.has(id)) return;
  running.add(id);
  const update = (change: (a: Attempt) => void) => {
    const fresh = getAttempt(id);
    if (fresh) {
      change(fresh);
      saveAttempt(fresh);
    }
  };
  const phase = (text: string) =>
    update((a) => {
      a.job.phase = text;
    });
  try {
    let a = getAttempt(id);
    if (!a) return;
    if (a.versions.questionnaire !== questionnaireFingerprint)
      throw new Error(
        'The questionnaire changed; the saved answers require review before recalculation.',
      );
    if (a.report) archiveReport(a);
    phase('Saving submitted work');
    writeRunExport(a, nameOf(id), path.join(dataDir, 'uploads'));
    phase('Reviewing learning evidence');
    const learning = await assessLearning(id);
    a = getAttempt(id);
    if (!a) return;
    phase('Evaluating the deliverable');
    let deliverable: Deliverable;
    const artifactHash = inputHash(a, 'deliverable');
    if (a.assessments?.deliverable?.inputHash === artifactHash)
      deliverable = a.assessments.deliverable.result;
    else {
      try {
        deliverable = await gradeDeliverable(a, nameOf(id));
        if (deliverable.verdict !== 'Pending')
          update((fresh) => {
            (fresh.assessments ||= {}).deliverable = cache(
              artifactHash,
              deliverable,
              String(deliverable.checks.model || 'deterministic'),
            );
          });
      } catch (error) {
        deliverable = {
          verdict: 'Pending',
          criteria: [],
          checks: { error: error instanceof Error ? error.message : 'Provider error' },
        };
      }
    }
    phase('Reviewing creation evidence');
    a = getAttempt(id);
    if (!a) return;
    let creation: Observation[];
    const creationHash = inputHash(a, 'creation', deliverable);
    if (a.assessments?.creation?.inputHash === creationHash)
      creation = a.assessments.creation.result;
    else {
      try {
        creation = await gradeTranscript(a, 'creation', nameOf(id), deliverable);
        if (!creation.some((o) => o.status === 'pending'))
          update((fresh) => {
            (fresh.assessments ||= {}).creation = cache(
              creationHash,
              creation,
              creation.find((o) => o.model)?.model || 'not-assessed',
            );
          });
      } catch (error) {
        creation = unscoredTranscript(
          'creation',
          'pending',
          `Evaluation unavailable: ${error instanceof Error ? error.message : 'provider error'}. Quiz baseline retained.`,
        );
      }
    }
    phase('Assembling your profile');
    a = getAttempt(id);
    if (!a) return;
    const previous = a.report;
    const report = calculateReport(a, [...learning, ...creation], deliverable);
    // Reuse successful commentary when its exact visible inputs are unchanged.
    if (previous?.version === SCORING_VERSION) {
      report.summaries = previous.summaries;
      report.summaryFingerprint = previous.summaryFingerprint;
    }
    report.commentary = { status: 'pending', completed: 0, total: 5 };
    update((fresh) => {
      fresh.report = report;
      fresh.stage = 'results';
      fresh.job.phase = 'Preparing reflections';
      fresh.versions.scoring = SCORING_VERSION;
    });
    await populateSummaries(a, report, nameOf(id), () =>
      update((fresh) => {
        fresh.report = report;
      }),
    );
    update((fresh) => {
      fresh.report = report;
      fresh.stage = 'results';
      fresh.job = { ...fresh.job, status: 'complete', phase: 'Complete' };
      writeRunExport(fresh, nameOf(id), path.join(dataDir, 'uploads'));
    });
  } catch (error) {
    update((fresh) => {
      fresh.job.status = 'error';
      fresh.job.error = error instanceof Error ? error.message : 'Evaluation failed. Please retry.';
      if (fresh.report?.commentary) fresh.report.commentary.status = 'complete';
    });
  } finally {
    running.delete(id);
  }
}
