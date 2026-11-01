import { essayDocx, transcript, solution } from '../tests/fixtures.js';

// Synthetic data only. Exercises the same HTTP flow as a student, including paid scoring calls.
const pathway = process.env.SMOKE_PATHWAY === 'essay' ? 'essay' : 'coding';
const origin = process.env.BASE_URL || 'http://localhost:4173';
let cookie = '';
async function call(path: string, data?: unknown, method = 'POST') {
  const response = await fetch(`${origin}/api${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(data instanceof FormData ? {} : { 'content-type': 'application/json' }),
    },
    body: data === undefined ? undefined : data instanceof FormData ? data : JSON.stringify(data),
    signal: AbortSignal.timeout(120000),
  });
  cookie ||= response.headers.get('set-cookie')?.split(';')[0] || '';
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${body.error}`);
  return body;
}
const config = await call('/config', undefined, 'GET');
console.log(
  JSON.stringify({
    event: 'configuration',
    mode: config.mode,
    jev: config.jevConfigured,
    commentary: config.commentaryConfigured,
  }),
);
if (config.mode !== 'live')
  throw new Error('Run the live smoke check against an isolated live-mode server.');
const content = await call('/content', undefined, 'GET');
await call('/attempt', { name: 'Synthetic integration check', consent: true });
for (const stage of ['self', 'quiz'] as const) {
  for (const question of content[stage])
    await call(
      '/answers',
      { stage, id: question.id, value: stage === 'self' ? 3 : 'B', cursor: 0 },
      'PATCH',
    );
  await call('/stage/submit');
}
async function upload(slot: string, name: string, buffer: Buffer) {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)]), name);
  const a = await call(`/upload/${slot}`, form);
  console.log(
    JSON.stringify({
      event: 'upload',
      slot,
      status: a.uploads[slot].parseStatus,
      turns: a.uploads[slot].turns.length,
    }),
  );
  if (slot !== 'deliverable') await call(`/upload/${slot}`, { complete: true }, 'PATCH');
}
await upload('learning', 'Learning conversation.docx', await essayDocx(transcript));
await call('/stage/submit');
await call('/pathway', { pathway });
if (pathway === 'coding') {
  await upload(
    'creation',
    'Creation conversation.json',
    Buffer.from(
      JSON.stringify({
        messages: [
          {
            role: 'user',
            content:
              'Help me solve Gifts Fixing in Python. I need a solution that uses standard input and handles large integers. Before coding, help me work out why the answer for each gift is the larger difference from the two minima.',
          },
          {
            role: 'assistant',
            content:
              'For gift i let da=a[i]-min(a) and db=b[i]-min(b). You can reduce both together min(da,db) times, then reduce the remaining difference separately. Total max(da,db).',
          },
          {
            role: 'user',
            content:
              'I see: if da is 3 and db is 5, three paired reductions and two separate reductions give five, not eight. We cannot do better than five because the larger difference needs that many steps. Summing per gift is valid because a move affects one gift. Please produce O(n) code without modifying minima mid-loop.',
          },
          { role: 'assistant', content: solution },
          {
            role: 'user',
            content:
              'I tested a=[3,5], b=[2,6]. Minima are 3 and 2, so differences are (0,0) and (2,4), answer four. For n=1, answer is zero. Python integers handle large sums. I will use this solution after checking the provided samples. AI helped implement the code; I worked through the argument and checked edge cases.',
          },
        ],
      }),
    ),
  );
  await upload('deliverable', 'solution.py', Buffer.from(solution));
} else {
  await upload('creation', 'Essay conversation.txt', Buffer.from(transcript));
  await upload(
    'deliverable',
    'Essay.docx',
    await essayDocx(`Recommendation algorithms learn from our choices and also change what we see. My position is that both processes matter, but a recommendation alone does not prove that a preference has changed.
A music service learns from listening history, skips and likes. Its ranked suggestions can make some artists much more visible than others. A student who discovers a new genre through these suggestions may develop an interest that was absent from their previous listening record.
Ricci, Rokach and Shapira, Recommender Systems Handbook (2015), describes how recommendation systems use observed behaviour and item characteristics. This explains why their predictions can reflect existing interests. It does not establish that every predicted interest existed before exposure.
Chaney, Stewart and Engelhardt, How Algorithmic Confounding in Recommendation Systems Increases Homogeneity and Decreases Utility (2018), shows through simulation how recommendations can shape subsequent behaviour and the data used to train future systems. The simulation supports a possible feedback mechanism, while its assumptions limit direct conclusions about every real user.
A strong alternative explanation is that recommendations reveal an interest that was already present. People also discover music through friends and events, and the service may simply predict that change. A controlled comparison of different recommendation policies would help distinguish these accounts more effectively than listening records alone.
Recommendation therefore involves both prediction and influence. Which process dominates depends on the interface, available choices and the person. We should evaluate the specific setting rather than assume every changed choice proves persuasion.
References
Ricci, F., Rokach, L., and Shapira, B. (eds.). Recommender Systems Handbook. Springer, 2015.
Chaney, A., Stewart, B., and Engelhardt, B. How Algorithmic Confounding in Recommendation Systems Increases Homogeneity and Decreases Utility. RecSys, 2018.`),
  );
}
await call('/stage/submit');
let previous = '';
for (let i = 0; i < 900; i++) {
  const a = await call('/attempt', undefined, 'GET');
  if (a.job.phase !== previous) {
    previous = a.job.phase;
    console.log(JSON.stringify({ event: 'phase', phase: previous }));
  }
  if (a.job.status === 'error') throw new Error(a.job.error);
  if (a.stage === 'results' && a.job.status === 'complete') {
    const report = a.report;
    const observations = report.capabilities.flatMap((c: any) => c.observations);
    if (
      report.version !== 'pilot-3.0-noul-boost' ||
      observations.length !== 48 ||
      observations.some((o: any) => o.status !== 'scored' || o.score < 0 || o.score > 1)
    )
      throw new Error('Practical scoring did not complete with 48 valid NOUL probabilities.');
    if (report.deliverable.verdict === 'Pending')
      throw new Error('Deliverable grading was unavailable.');
    for (const [index, key] of [
      'quiz',
      'quiz-self',
      'learning-self',
      'creation-self',
      'both-self',
    ].entries()) {
      const summary = report.summaries[key];
      if (summary?.source !== 'llm' || summary.paragraphs.length !== (index === 1 ? 1 : 2))
        throw new Error(
          `Commentary did not complete for ${key}: ${JSON.stringify(report.diagnostics)}`,
        );
    }
    for (const view of Object.values(report.views) as any[])
      for (const c of view.capabilities)
        if (c.quiz !== null && (c.score < c.quiz || c.score > 100))
          throw new Error('Boost-only scoring invariant failed.');
    console.log(
      JSON.stringify({
        event: 'completed',
        id: a.id,
        mode: a.mode,
        pathway,
        scoringVersion: report.version,
        jevModels: [...new Set(observations.map((o: any) => o.model))],
        claudeModels: [...new Set(Object.values(report.summaries).map((s: any) => s.model))],
        observations: report.capabilities
          .flatMap((c: any) => c.observations)
          .reduce(
            (counts: Record<string, number>, o: any) => ({
              ...counts,
              [o.status]: (counts[o.status] || 0) + 1,
            }),
            {},
          ),
        reasons: [
          ...new Set(
            report.capabilities.flatMap((c: any) =>
              c.observations.filter((o: any) => o.status === 'pending').map((o: any) => o.reason),
            ),
          ),
        ],
        deliverable: report.deliverable.verdict,
        deliverableError: report.deliverable.checks.error,
        summaries: Object.fromEntries(
          Object.entries(report.summaries || {}).map(([key, value]: [string, any]) => [
            key,
            value.source,
          ]),
        ),
        diagnostics: report.diagnostics,
        views: Object.keys(report.views || {}),
      }),
    );
    break;
  }
  if (i === 899) throw new Error('Evaluation exceeded the integration-test deadline.');
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
