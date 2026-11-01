import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicContent, capabilities, domains, quizKey } from './content.js';
import { orderedQuizQuestions } from '../shared/quiz-order.js';
import type { Attempt, ProfileView } from '../shared/types.js';

export const runExportDir = path.resolve(
  process.env.RUN_EXPORT_DIR || fileURLToPath(new URL('../../student-runs/', import.meta.url)),
);
const token = (value: string) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error('Invalid run identifier.');
  return value;
};
type Cell = string | number | boolean | null | undefined;
type Row = Record<string, Cell>;
// Quote every field so commas, quotes and multiline questions round-trip in pandas/Excel.
export function csv(rows: Row[], headers = Object.keys(rows[0] ?? {})) {
  const quote = (value: Cell) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return (
    [
      headers.map(quote).join(','),
      ...rows.map((row) => headers.map((h) => quote(row[h])).join(',')),
    ].join('\r\n') + '\r\n'
  );
}
export function runTables(a: Attempt, name: string) {
  const common = {
    attempt_id: a.id,
    student_name: name,
    mode: a.mode,
    pathway: a.pathway,
    grading_run: a.job.run,
  };
  const domainName = (id: string) => domains.find((d) => d.id === id)?.name;
  const selfLabels = ['Not at all', 'Slightly', 'Moderately', 'Well', 'Very well'];
  const self = publicContent.self.map((q, index) => {
    const c = capabilities.find((c) => c.id === q.id)!;
    const answer = a.self[q.id];
    const rating = typeof answer === 'number' ? answer : null;
    return {
      ...common,
      presented_position: index + 1,
      capability_id: c.id,
      capability: c.name,
      domain_id: c.domain,
      domain: domainName(c.domain),
      question: q.prompt,
      answer_value: answer,
      answer_label:
        rating === null ? (answer === undefined ? '' : 'Not sure') : selfLabels[rating - 1],
      answer_description: rating === null ? '' : q.selfDescriptions?.[rating - 1],
      self_rating_1_to_5: rating,
      ...Object.fromEntries(
        (q.selfDescriptions ?? []).map((text, i) => [
          `option_${i + 1}`,
          `${selfLabels[i]}: ${text}`,
        ]),
      ),
    };
  });
  const quiz = orderedQuizQuestions(publicContent.quiz, a.quizOrder).map((q, index) => {
    const key = quizKey[q.id],
      c = capabilities.find((c) => c.id === key.capability)!;
    const answer = a.quiz[q.id],
      selected = q.options?.find((o) => o.id === answer);
    const points = answer === undefined ? null : (key.points[answer] ?? 0);
    const correct = q.options?.find((o) => key.points[o.id] === key.max);
    return {
      ...common,
      presented_position: index + 1,
      question_id: q.id,
      capability_id: c.id,
      capability: c.name,
      domain_id: c.domain,
      domain: domainName(c.domain),
      question: q.prompt,
      answer_value: answer,
      answer_text: selected?.text ?? (answer === undefined ? '' : 'Not sure'),
      answer_summary: selected?.summary,
      points,
      maximum_points: key.max,
      score_0_to_100: points === null ? null : (100 * points) / key.max,
      correct_answer: correct?.id,
      correct_answer_text: correct?.text,
      ...Object.fromEntries((q.options ?? []).map((o) => [`option_${o.id}`, o.text])),
    };
  });
  const capabilityScores = capabilities.map((c) => {
    const row = a.report?.capabilities.find((v) => v.id === c.id);
    const learning = row?.observations.find((o) => o.task === 'learning');
    const creation = row?.observations.find((o) => o.task === 'creation');
    const value = (view: ProfileView) =>
      a.report?.views?.[view].capabilities.find((v) => v.id === c.id);
    return {
      ...common,
      capability_id: c.id,
      capability: c.name,
      description: c.description,
      domain_id: c.domain,
      domain: domainName(c.domain),
      self_rating_1_to_5: typeof a.self[c.id] === 'number' ? a.self[c.id] : null,
      quiz_score_0_to_100: value('quiz')?.score,
      learning_status: c.id === 'C5' ? 'not_assessed' : (learning?.status ?? 'pending'),
      learning_jev_probability: learning?.score,
      learning_model: learning?.model,
      learning_reason: learning?.reason,
      creation_status:
        c.id === 'C5'
          ? (a.report?.deliverable.verdict ?? 'Pending')
          : (creation?.status ?? 'pending'),
      creation_jev_probability: creation?.score,
      creation_model: creation?.model,
      creation_reason: creation?.reason,
      creation_output_binary: c.id === 'C5' ? value('creation')?.practical : null,
      learning_boost: value('learning')?.adjustment,
      creation_boost: value('creation')?.adjustment,
      with_learning_0_to_100: value('learning')?.score,
      with_creation_0_to_100: value('creation')?.score,
      with_both_0_to_100: value('both')?.score,
    };
  });
  const domainScores = domains.map((d) => {
    const value = (view: ProfileView) =>
      a.report?.views?.[view].dimensions.find((v) => v.id === d.id);
    const ratings = capabilities
      .filter((c) => c.domain === d.id)
      .map((c) => a.self[c.id])
      .filter((v): v is number => typeof v === 'number');
    const projected = value('quiz')?.self;
    return {
      ...common,
      domain_id: d.id,
      domain: d.name,
      capability_count: capabilities.filter((c) => c.domain === d.id).length,
      self_rated_count: ratings.length,
      self_rating_mean_1_to_5: projected == null ? null : 1 + projected / 25,
      self_projected_0_to_100: projected,
      ...Object.fromEntries(
        (['quiz', 'learning', 'creation', 'both'] as const).flatMap((view) => [
          [`${view}_score_0_to_100`, value(view)?.score],
          [`${view}_band`, value(view)?.band],
          [`${view}_coverage`, value(view)?.coverage],
          [`${view}_pending`, value(view)?.pending],
        ]),
      ),
    };
  });
  const code = a.report?.deliverable.checks.code as
    { status?: string; detail?: string; cases?: number; durationMs?: number } | undefined;
  const outputScores = (
    a.report?.deliverable.criteria.length
      ? a.report.deliverable.criteria
      : [
          {
            id: a.report ? 'evaluation_unavailable' : 'awaiting_evaluation',
            label: a.report ? 'Evaluation unavailable' : 'Awaiting evaluation',
            verdict: 'Pending',
            reason: String(a.report?.deliverable.checks.error ?? ''),
          },
        ]
  ).map((c) => ({
    ...common,
    method:
      c.id === 'human-review'
        ? 'human_review'
        : a.pathway === 'coding'
          ? 'deterministic_tests'
          : a.mode === 'demo'
            ? 'illustrative'
            : 'jev_noul',
    criterion_id: c.id,
    criterion: c.label,
    criterion_verdict: c.verdict,
    criterion_probability: 'probability' in c ? c.probability : null,
    reason: c.reason,
    overall_verdict: a.report?.deliverable.verdict ?? 'Pending',
    output_binary:
      a.report?.deliverable.verdict === 'Pass'
        ? 1
        : a.report?.deliverable.verdict === 'Fail'
          ? 0
          : null,
    model: a.report?.deliverable.checks.model as string | undefined,
    test_verdict: code?.status,
    test_case_count: code?.cases,
    test_detail: code?.detail,
    duration_ms: code?.durationMs,
  }));
  return {
    'self_assessment.csv': self,
    'capability_quiz.csv': quiz,
    'capability_scores.csv': capabilityScores,
    'domain_scores.csv': domainScores,
    'creation_output_scores.csv': outputScores,
  };
}

export function writeRunExport(a: Attempt, name: string, uploadsRoot: string, root = runExportDir) {
  if (!a.pathway || !a.uploads.deliverable || !a.uploads.learning || !a.uploads.creation)
    throw new Error('A complete submission is required for a run export.');
  const id = token(a.id),
    modeDir = path.join(root, a.mode),
    target = path.join(modeDir, id),
    previous = `${target}.previous`;
  const artifact = a.uploads.deliverable;
  if (!['.pdf', '.docx', '.py'].includes(artifact.extension))
    throw new Error('Unsupported deliverable extension.');
  const original = path.join(uploadsRoot, id, token(artifact.id));
  if (!fs.existsSync(original))
    throw new Error('The original creation file is missing; the run could not be fully exported.');
  fs.mkdirSync(modeDir, { recursive: true, mode: 0o700 });
  const temporary = fs.mkdtempSync(path.join(modeDir, `.${id}-`));
  try {
    for (const [filename, rows] of Object.entries(runTables(a, name)))
      fs.writeFileSync(path.join(temporary, filename), csv(rows), { mode: 0o600 });
    for (const task of ['learning', 'creation'] as const)
      fs.writeFileSync(path.join(temporary, `${task}_transcript.txt`), a.uploads[task]!.text, {
        mode: 0o600,
      });
    const outputFilename = `creation_output${artifact.extension}`;
    fs.copyFileSync(original, path.join(temporary, outputFilename));
    fs.chmodSync(path.join(temporary, outputFilename), 0o600);
    fs.writeFileSync(
      path.join(temporary, 'run.json'),
      JSON.stringify(
        {
          exportVersion: '1.0',
          exportedAt: new Date().toISOString(),
          studentName: name,
          outputFilename,
          originalOutputFilename: artifact.name,
          ...a,
        },
        null,
        2,
      ) + '\n',
      { mode: 0o600 },
    );
    // Replace the complete bundle together, retaining the previous bundle if a write fails.
    if (fs.existsSync(previous) && !fs.existsSync(target)) fs.renameSync(previous, target);
    fs.rmSync(previous, { recursive: true, force: true });
    if (fs.existsSync(target)) fs.renameSync(target, previous);
    try {
      fs.renameSync(temporary, target);
    } catch (error) {
      if (fs.existsSync(previous)) fs.renameSync(previous, target);
      throw error;
    }
    fs.rmSync(previous, { recursive: true, force: true });
    return target;
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
