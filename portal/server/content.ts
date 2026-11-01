import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { PublicContent, Question } from '../shared/types.js';
import { domains, frameworkCapabilities } from '../shared/framework.js';
export { domains } from '../shared/framework.js';

const materialDir = fileURLToPath(new URL('../../material/', import.meta.url));
const read = (name: string) => fs.readFileSync(materialDir + name, 'utf8');
export const deckPath = `${materialDir}tasks/task_1_learning/How Memory and Attention Work.pdf`;
const selfSource = read('quizzes/self-assessment.md');
export const selfVersion = '2.6';
export const quizVersion = '2.2';
const quizSource = read('quizzes/capability-quiz.md');

export const capabilities = frameworkCapabilities;

function parseSelf(): Question[] {
  const part = selfSource.split('## Part A.')[1].split('## Part B.')[0];
  return [
    ...part.matchAll(/^#### ([ULCR]\d)\. (.+)\n+([\s\S]*?)(?=^#### |^### |(?![\s\S]))/gm),
  ].map((m) => {
    const body = m[3].split('Response:')[0].trim().split(/\n\n+/);
    const anchors = [...m[3].matchAll(/^\| ([1-5]) \| (.+) \|$/gm)];
    if (anchors.length !== 5 || anchors.some((a, i) => Number(a[1]) !== i + 1))
      throw new Error(`Missing or unordered self-assessment descriptions for ${m[1]}.`);
    return {
      id: m[1],
      title: m[2],
      prompt: body[0],
      selfDescriptions: anchors.map((a) => a[2]),
    };
  });
}
function parseQuiz(): Question[] {
  const part = quizSource.split('## Part A.')[1].split('## Part B.')[0];
  return [...part.matchAll(/^### (Q\d\d)\. (.+)\n+([\s\S]*?)(?=^### |^## |(?![\s\S]))/gm)].map(
    (m) => {
      const body = m[3].split('Answer:')[0].trim();
      const summaries = Object.fromEntries(
        [...m[3].matchAll(/^\| ([A-D]) \| (.+) \|$/gm)].map((s) => [s[1], s[2]]),
      );
      const options = [...body.matchAll(/^([A-D])\. (.+)$/gm)].map((o) => ({
        id: o[1],
        text: o[2],
        summary: summaries[o[1]],
      }));
      if (options.length !== 4 || options.some((o) => !o.summary?.trim()))
        throw new Error(`Invalid options or review summaries: ${m[1]}`);
      return { id: m[1], title: m[2], prompt: body.split(/^A\. /m)[0].trim(), options };
    },
  );
}
export const quizKey = Object.fromEntries(
  quizSource
    .split('\n')
    .filter((l) => /^\| Q\d\d \|/.test(l))
    .map((l) => {
      const r = l
        .split('|')
        .slice(1, -1)
        .map((s) => s.trim());
      return [
        r[0],
        {
          capability: r[1],
          points: Object.fromEntries(['A', 'B', 'C', 'D'].map((k, i) => [k, Number(r[i + 4])])),
          max: Number(r[8]),
        },
      ];
    }),
);
export const publicContent: PublicContent = {
  codingProblem: read('tasks/task_3_coding/problem.md'),
  self: parseSelf(),
  quiz: parseQuiz(),
  domains,
  capabilities,
  briefs: {
    learning: read('tasks/task_1_learning/brief.md'),
    essay: read('tasks/task_2_essay/brief.md'),
    coding: read('tasks/task_3_coding/brief.md'),
  },
};
const capabilityIds = capabilities.map((c) => c.id);
const selfIds = publicContent.self.map((q) => q.id);
const quizIds = publicContent.quiz.map((q) => q.id);
if (
  capabilities.length !== 25 ||
  new Set(capabilityIds).size !== capabilities.length ||
  JSON.stringify(selfIds) !== JSON.stringify(capabilityIds) ||
  publicContent.quiz.length !== 25 ||
  new Set(quizIds).size !== quizIds.length ||
  Object.keys(quizKey).length !== quizIds.length ||
  quizIds.some((id) => !quizKey[id]) ||
  Object.values(quizKey).some((q) => !capabilityIds.includes(q.capability)) ||
  JSON.stringify(Object.values(quizKey).map((q) => q.capability)) !==
    JSON.stringify(capabilityIds) ||
  Object.values(quizKey).some(
    (q) =>
      q.max !== 1 ||
      Object.values(q.points).filter((p) => p === 1).length !== 1 ||
      Object.values(q.points).some((p) => p !== 0 && p !== 1),
  )
)
  throw new Error('Instrument snapshot failed validation.');

// Review labels are presentation metadata, so adding or editing them must not reset
// compatible attempts. Questions, full answer text and the scoring key remain guarded.
const assessmentContent = {
  ...publicContent,
  quiz: publicContent.quiz.map((q) => ({
    ...q,
    options: q.options?.map(({ id, text }) => ({ id, text })),
  })),
};
// Practical materials can be revised without invalidating saved questionnaire answers.
export const questionnaireFingerprint = createHash('sha256')
  .update(
    JSON.stringify({
      self: assessmentContent.self,
      quiz: assessmentContent.quiz,
      domains: assessmentContent.domains,
      capabilities: assessmentContent.capabilities,
      quizKey,
    }),
  )
  .digest('hex');
export const contentFingerprint = createHash('sha256')
  .update(JSON.stringify({ publicContent: assessmentContent, quizKey }))
  .update(fs.readFileSync(deckPath))
  .digest('hex');

export const deliverableRubrics = {
  essay: [
    [
      'argument',
      'Argument',
      'Answers the question directly and supports a clear, reasoned position.',
    ],
    [
      'analysis',
      'Analysis',
      'Explains how algorithms learn and shape preferences, and considers a strong counterargument or alternative explanation.',
    ],
    [
      'evidence',
      'Evidence',
      'Uses a concrete example and at least two identifiable sources supporting substantive claims. Check supplied independent source passages, not just citations.',
    ],
    [
      'judgement',
      'Judgement',
      'Acknowledges an important limitation and draws a conclusion supported by the evidence.',
    ],
    [
      'communication',
      'Communication and format',
      'Clear, organized writing within the 1000-word limit, with a bibliography. The word limit excludes the bibliography.',
    ],
  ],
};
