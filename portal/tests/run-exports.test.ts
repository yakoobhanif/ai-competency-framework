import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { csv, runTables, writeRunExport, runExportDir } from '../server/run-exports.js';
import type { CapabilityResult } from '../shared/types.js';
import { fixtureAttempt, observations, essayDocx, transcript } from './fixtures.js';
import { validateUpload } from '../server/evidence.js';
import { calculateReport } from '../server/scoring.js';
import { quizKey, publicContent } from '../server/content.js';
import {
  createAttempt,
  getAttempt,
  saveAttempt,
  saveOriginal,
  deleteAttempt,
  dataDir,
} from '../server/store.js';
import { evaluate } from '../server/worker.js';

const pass = {
  verdict: 'Pass' as const,
  criteria: [
    {
      id: 'argument',
      label: 'Argument',
      probability: 0.85,
      verdict: 'Pass' as const,
      reason: 'Synthetic',
    },
  ],
  checks: { model: 'test' },
};
test('CSV preserves commas, quotes, line breaks, null values and numeric zero', () => {
  assert.equal(
    csv([{ question: 'A, "quoted"\nquestion', score: 0, missing: null }]),
    '"question","score","missing"\r\n"A, ""quoted""\nquestion","0",""\r\n',
  );
});
test('tables preserve presented order, selected full answers, exact scores and missing values', () => {
  const a = fixtureAttempt();
  a.quizOrder = publicContent.quiz.map((q) => q.id).reverse();
  a.self.U1 = 'not_sure';
  a.quiz.Q01 = 'not_sure';
  a.report = calculateReport(a, observations(), pass);
  const tables = runTables(a, 'A student');
  assert.equal(tables['self_assessment.csv'].length, 25);
  assert.equal(tables['self_assessment.csv'][0].self_rating_1_to_5, null);
  assert.equal(tables['self_assessment.csv'][0].answer_label, 'Not sure');
  const quiz = tables['capability_quiz.csv'];
  assert.deepEqual(
    quiz.map((q) => q.question_id),
    a.quizOrder,
  );
  assert.equal(quiz.at(-1)!.answer_text, 'Not sure');
  assert.equal(quiz.at(-1)!.points, 0);
  for (const row of quiz) {
    assert.equal(row.points, quizKey[row.question_id].points[a.quiz[row.question_id]] ?? 0);
    assert(row.question);
    assert('option_A' in row && row.option_A);
    assert(row.correct_answer_text);
  }
  for (const row of tables['capability_scores.csv']) {
    const c: CapabilityResult = a.report.capabilities.find(
      (item) => item.id === row.capability_id,
    )!;
    assert.equal(row.with_both_0_to_100, c.score);
    assert.equal(
      row.learning_jev_probability,
      c.observations.find((o) => o.task === 'learning')?.score,
    );
  }
  const c5 = tables['capability_scores.csv'].find((row) => row.capability_id === 'C5')!;
  assert.equal(c5.learning_status, 'not_assessed');
  assert.equal(c5.creation_output_binary, 1);
  assert.equal(c5.creation_jev_probability, undefined);
  for (const row of tables['domain_scores.csv'])
    for (const view of ['quiz', 'learning', 'creation', 'both'] as const)
      assert.equal(
        row[`${view}_score_0_to_100`],
        a.report.views![view].dimensions.find((d) => d.id === row.domain_id)!.score,
      );
  a.report.deliverable.verdict = 'Pending';
  assert.equal(runTables(a, '')['creation_output_scores.csv'][0].output_binary, null);
});
test('both modes export complete bundles, preserve original bytes, replace cleanly and delete', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'student-runs-'));
  try {
    for (const mode of ['demo', 'live'] as const)
      for (const pathway of ['essay', 'coding'] as const) {
        const a = fixtureAttempt();
        a.id = `${mode}-${pathway}`;
        a.mode = mode;
        a.pathway = pathway;
        a.uploads.learning = await validateUpload(
          'learning.txt',
          Buffer.from(transcript),
          'learning',
          null,
        );
        a.uploads.creation = { ...a.uploads.learning };
        const bytes = pathway === 'essay' ? await essayDocx() : Buffer.from('print(0)\r\n');
        a.uploads.deliverable = await validateUpload(
          pathway === 'essay' ? 'Essay.docx' : 'answer.py',
          bytes,
          'deliverable',
          pathway,
        );
        a.report = calculateReport(a, observations(), pass);
        const uploadsRoot = path.join(root, 'uploads');
        fs.mkdirSync(path.join(uploadsRoot, a.id), { recursive: true });
        fs.writeFileSync(path.join(uploadsRoot, a.id, a.uploads.deliverable.id), bytes);
        const bundle = writeRunExport(a, 'Same name', uploadsRoot, path.join(root, 'exports'));
        assert.equal(fs.readdirSync(bundle).length, 9);
        const output = `creation_output${a.uploads.deliverable.extension}`;
        assert.deepEqual(fs.readFileSync(path.join(bundle, output)), bytes);
        assert.equal(
          fs.readFileSync(path.join(bundle, 'learning_transcript.txt'), 'utf8'),
          a.uploads.learning.text,
        );
        const run = JSON.parse(fs.readFileSync(path.join(bundle, 'run.json'), 'utf8'));
        assert.equal(run.studentName, 'Same name');
        assert.equal(run.mode, mode);
        assert.equal(run.originalOutputFilename, a.uploads.deliverable.name);
        assert(!('token_hash' in run));
        assert(!('token' in run));
        a.self.U1 = 5;
        a.job.run++;
        writeRunExport(a, 'Same name', uploadsRoot, path.join(root, 'exports'));
        assert.equal(JSON.parse(fs.readFileSync(path.join(bundle, 'run.json'), 'utf8')).self.U1, 5);
        assert(!fs.existsSync(`${bundle}.previous`));
        // A failed update must leave the previous complete bundle intact.
        fs.rmSync(path.join(uploadsRoot, a.id, a.uploads.deliverable.id));
        assert.throws(
          () => writeRunExport(a, '', uploadsRoot, path.join(root, 'exports')),
          /original creation file/,
        );
        assert(fs.existsSync(path.join(bundle, 'run.json')));
        fs.rmSync(bundle, { recursive: true, force: true });
        assert(!fs.existsSync(bundle));
      }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test('worker automatically exports final results and session deletion preserves the archive', async () => {
  const { attempt: a } = createAttempt('Synthetic automatic export', 'demo');
  try {
    a.pathway = 'essay';
    a.stage = 'processing';
    a.self = fixtureAttempt().self;
    a.quiz = fixtureAttempt().quiz;
    a.uploads.learning = await validateUpload(
      'learning.txt',
      Buffer.from(transcript),
      'learning',
      null,
    );
    a.uploads.learning.complete = true;
    a.uploads.creation = { ...a.uploads.learning };
    const bytes = await essayDocx();
    a.uploads.deliverable = await validateUpload('essay.docx', bytes, 'deliverable', 'essay');
    saveOriginal(a, a.uploads.deliverable.id, bytes);
    saveAttempt(a);
    await evaluate(a.id);
    const finished = getAttempt(a.id)!;
    assert.equal(finished.job.status, 'complete');
    const bundle = path.join(runExportDir, 'demo', a.id);
    const snapshot = JSON.parse(fs.readFileSync(path.join(bundle, 'run.json'), 'utf8'));
    assert.equal(snapshot.job.status, 'complete');
    assert.deepEqual(snapshot.report.views, finished.report!.views);
    assert.equal(snapshot.report.deliverable.verdict, 'Pass');
    assert.deepEqual(fs.readFileSync(path.join(bundle, 'creation_output.docx')), bytes);
    // Existing report output is retained if a subsequent export cannot find its source file.
    fs.rmSync(path.join(dataDir, 'uploads', a.id, a.uploads.deliverable.id));
    await evaluate(a.id);
    assert.equal(getAttempt(a.id)!.job.status, 'error');
    assert(fs.existsSync(path.join(bundle, 'run.json')));
  } finally {
    deleteAttempt(getAttempt(a.id) ?? a);
  }
  const bundle = path.join(runExportDir, 'demo', a.id);
  try {
    assert(fs.existsSync(path.join(bundle, 'run.json')));
    assert(!getAttempt(a.id));
  } finally {
    fs.rmSync(bundle, { recursive: true, force: true });
  }
});

for (const mode of ['demo', 'live'] as const)
  test(`${mode}: expired session cleanup preserves the student-run archive`, async () => {
    const { attempt: a } = createAttempt('Synthetic retention check', mode);
    const bundle = path.join(runExportDir, mode, a.id);
    try {
      a.createdAt = new Date(Date.now() - 31 * 86400000).toISOString();
      a.pathway = 'coding';
      a.uploads.learning = await validateUpload(
        'learning.txt',
        Buffer.from(transcript),
        'learning',
        null,
      );
      a.uploads.creation = { ...a.uploads.learning };
      const bytes = Buffer.from('print(0)\n');
      a.uploads.deliverable = await validateUpload('answer.py', bytes, 'deliverable', 'coding');
      saveOriginal(a, a.uploads.deliverable.id, bytes);
      saveAttempt(a);
      writeRunExport(a, 'Synthetic retention check', path.join(dataDir, 'uploads'));
      // Startup expiry, Start fresh and assessment deletion share this cleanup function.
      deleteAttempt(a);
      assert(!getAttempt(a.id));
      assert(!fs.existsSync(path.join(dataDir, 'uploads', a.id)));
      assert.deepEqual(fs.readFileSync(path.join(bundle, 'creation_output.py')), bytes);
      assert(fs.existsSync(path.join(bundle, 'run.json')));
    } finally {
      deleteAttempt(a);
      // Test fixtures are manually removed; production archives have no automatic expiry.
      fs.rmSync(bundle, { recursive: true, force: true });
    }
  });
