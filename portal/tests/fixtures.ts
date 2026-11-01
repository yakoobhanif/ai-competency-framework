import JSZip from 'jszip';
import type { Attempt, Observation } from '../shared/types.js';
import { capabilities, publicContent, quizKey } from '../server/content.js';

export const transcript = `User: I want to understand how attention affects memory. I currently confuse familiarity with retention. Please ask a practice question before giving feedback.
Assistant: Why might rereading feel effective without improving delayed recall?
User: Familiarity with a page can feel like learning, but retrieval requires reconstructing the idea. My first attempt is that attention determines what reaches working memory and practice retrieving it supports later access.
Assistant: That distinction is useful. How could you check this account?
User: I compared your account against slides 3 and 10. Slide 3 shows attention selecting information for working memory; slide 10 recommends retrieval. They agree on those limited claims. The percentages are study-specific, not promises.
Assistant: Apply this to a student preparing for an exam in three days.
User: I would put the phone away to reduce switching, then practise recalling ideas over the three days rather than rereading continuously. Attention reduces interruptions; spaced retrieval tests retention beyond familiarity. These methods are not a guarantee for every subject. I used an AI assistant for questions and feedback, checked the supplied slides myself, and am ready to try this study plan while checking what I can recall tomorrow.`;

export const solution = `# AI assisted the outline; I checked the algorithm and tests.
# For each gift, both differences can be reduced together, then separately.
# Each answer is the sum of maxima of differences from the minima: O(n).
import sys
data = iter(map(int, sys.stdin.buffer.read().split()))
t = next(data)
out = []
for _ in range(t):
    n = next(data)
    a = [next(data) for _ in range(n)]
    b = [next(data) for _ in range(n)]
    ma, mb = min(a), min(b)
    out.append(str(sum(max(x-ma,y-mb) for x,y in zip(a,b))))
print('\\n'.join(out))
`;

export async function essayDocx(textOverride?: string) {
  const text =
    textOverride ??
    'Recommendation algorithms both learn and shape preferences. They learn from past actions, but exposure changes which options people notice. A music service can recommend a familiar genre while introducing new artists. A counterargument is that observed change may reflect a preference that existed before exposure rather than persuasion. Therefore behavioral evidence alone cannot establish a causal effect. Platform design and user choice can both matter. A proportionate conclusion is that recommendation and preference formation interact, but their relative contribution depends on context.\nReferences\nSource one: https://example.org/research\nSource two: https://example.com/study';
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${text
      .split('\n')
      .map(
        (t) =>
          `<w:p><w:r><w:t>${t.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</w:t></w:r></w:p>`,
      )
      .join('')}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}
export function fixtureAttempt(): Attempt {
  return {
    id: 'test',
    stage: 'results',
    mode: 'demo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    self: Object.fromEntries(capabilities.map((c) => [c.id, 3])),
    // Keep R5 correct and other baselines incorrect to exercise both calibration directions.
    quiz: Object.fromEntries(
      publicContent.quiz.map((q) => {
        const key = quizKey[q.id];
        return [
          q.id,
          Object.entries(key.points).find(
            ([, p]) => p === (key.capability === 'R5' ? 1 : 0),
          )![0] as 'A' | 'B' | 'C' | 'D',
        ];
      }),
    ),
    cursor: { self: publicContent.self.length, quiz: publicContent.quiz.length },
    pathway: 'essay',
    uploads: {},
    stageStarted: {},
    job: { status: 'complete', phase: 'Complete', run: 1 },
    report: null,
    consent: true,
    versions: {},
  };
}
export function observations(): Observation[] {
  return (['learning', 'creation'] as const).flatMap((task) =>
    capabilities
      .filter((c) => c.id !== 'C5')
      .map(({ id }, i) => ({
        capability: id,
        task,
        status: 'scored',
        score: [0.85, 0.4, 0.75, 0.6][(i + (task === 'creation' ? 1 : 0)) % 4],
        reason: 'Synthetic NOUL probability.',
        model: 'test',
      })),
  );
}
