import { writeRunExport } from './run-exports.js';
import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createServer } from 'node:http';
import {
  publicContent,
  capabilities,
  selfVersion,
  quizVersion,
  questionnaireFingerprint,
  deckPath,
} from './content.js';
import {
  createAttempt,
  fromToken,
  saveAttempt,
  getAttempt,
  allAttempts,
  nameOf,
  deleteAttempt,
  saveOriginal,
  isAdmin,
  dataDir,
  archiveReport,
} from './store.js';
import { validateUpload } from './evidence.js';
import { evaluate, assessLearning } from './worker.js';
import { calculateReport } from './scoring.js';
import { populateSummaries } from './summaries.js';
import { fetchSharedChat, sharedChatUpload } from './shared-chat.js';
import type { Attempt, Stage } from '../shared/types.js';

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  const host = req.get('host') || '';
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))
    return res.status(403).json({ error: 'This local app accepts localhost requests only.' });
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.get('origin') &&
    req.get('origin') !== `http://${host}`
  )
    return res.status(403).json({ error: 'Cross-origin requests are not allowed.' });
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '1mb' }));
const mode = process.env.ASSESSMENT_MODE === 'live' ? 'live' : 'demo';
const uploads = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1, parts: 2 },
});
const cookieToken = (req: express.Request) =>
  (req.headers.cookie || '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('assessment='))
    ?.slice(11) || '';
const owned = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const a = fromToken(cookieToken(req));
  if (!a)
    return res.status(401).json({ error: 'Your session was not found. Start a new assessment.' });
  res.locals.attempt = a;
  next();
};
const admin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!isAdmin(req.get('x-reviewer-token') || ''))
    return res.status(401).json({ error: 'Enter the local reviewer token.' });
  next();
};
const view = (a: Attempt) => ({ ...a, name: nameOf(a.id) });
function requireStage(a: Attempt, ...stages: Stage[]) {
  if (!stages.includes(a.stage))
    throw Object.assign(new Error('This stage is already submitted or is not yet available.'), {
      status: 409,
    });
}
function advance(a: Attempt, stage: Stage) {
  a.stage = stage;
  if (stage !== 'quiz' && stage !== 'learning') a.stageStarted[stage] = new Date().toISOString();
  saveAttempt(a);
}

app.get('/api/config', (_req, res) =>
  res.json({
    mode,
    jevConfigured: Boolean(process.env.TYPESAFE_API_KEY),
    commentaryConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    selfVersion,
    quizVersion,
    questionnaireFingerprint,
  }),
);
app.get('/api/content', (_req, res) => res.json(publicContent));
app.get('/memory-attention.pdf', (_req, res) => res.sendFile(deckPath));
app.get('/api/attempt', (req, res) => {
  const a = fromToken(cookieToken(req));
  res.json(a ? view(a) : null);
});
app.post('/api/attempt', (req, res) => {
  const body = z
    .object({ name: z.string().trim().min(1).max(100), consent: z.literal(true) })
    .parse(req.body);
  const { attempt, token } = createAttempt(body.name, mode);
  res.cookie('assessment', token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 30 * 86400000,
    path: '/',
  });
  res.status(201).json(view(attempt));
});
app.delete('/api/attempt', owned, (_req, res) => {
  const a = res.locals.attempt as Attempt;
  if (a.job.status === 'running')
    return res
      .status(409)
      .json({ error: 'Wait for the current evaluation before deleting this attempt.' });
  deleteAttempt(a);
  res.clearCookie('assessment', { path: '/' });
  res.json({ ok: true });
});
for (const stage of ['self', 'quiz', 'learning'] as const) {
  app.post(`/api/${stage}/start`, owned, (_req, res) => {
    const a = res.locals.attempt as Attempt;
    requireStage(a, stage);
    if (a.versions.questionnaire !== questionnaireFingerprint)
      return res.status(409).json({
        error: 'The assessment has changed. Start fresh to use the current questionnaire.',
      });
    // Reading an introduction, reloading or retrying must not consume or reset the timer.
    if (!a.stageStarted[stage]) {
      a.stageStarted[stage] = new Date().toISOString();
      saveAttempt(a);
    }
    res.json(view(a));
  });
}

app.patch('/api/answers', owned, (req, res) => {
  const body = z
    .object({
      stage: z.enum(['self', 'quiz']),
      id: z.string(),
      value: z.union([z.number().int().min(1).max(5), z.enum(['not_sure', 'A', 'B', 'C', 'D'])]),
      cursor: z.number().int().min(0).max(100),
    })
    .parse(req.body);
  const a = res.locals.attempt as Attempt;
  requireStage(a, body.stage);
  if (a.versions.questionnaire !== questionnaireFingerprint)
    return res.status(409).json({
      error: 'The questionnaire has changed. Start fresh to use the current assessment.',
    });
  if (a.versions.quiz !== quizVersion)
    return res
      .status(409)
      .json({ error: 'The quiz has changed. Start fresh to use the current assessment.' });
  if (body.stage === 'self' && a.versions.self !== selfVersion)
    return res.status(409).json({
      error: 'The self-assessment has changed. Start fresh to use the revised questionnaire.',
    });
  if (!publicContent[body.stage].some((q) => q.id === body.id))
    throw new Error('Unknown question.');
  if (body.stage === 'self') {
    const v = z.union([z.number().int().min(1).max(5), z.literal('not_sure')]).parse(body.value);
    a.self[body.id] = v;
  } else a.quiz[body.id] = z.enum(['A', 'B', 'C', 'D', 'not_sure']).parse(body.value);
  const questionCount = publicContent[body.stage].length;
  // Preserve review access when editing an answer, including attempts saved
  // on the summary before this flag was introduced.
  if (a.cursor[body.stage] === questionCount || body.cursor >= questionCount)
    (a.reviewReached ??= {})[body.stage] = true;
  a.cursor[body.stage] = Math.min(body.cursor, questionCount);
  saveAttempt(a);
  res.json(view(a));
});
app.post('/api/stage/submit', owned, (_req, res) => {
  const a = res.locals.attempt as Attempt;
  requireStage(a, 'self', 'quiz', 'learning', 'creation');
  if (a.versions.questionnaire !== questionnaireFingerprint)
    return res
      .status(409)
      .json({ error: 'The assessment has changed. Start fresh rather than mixing versions.' });
  if (a.stage === 'self' && a.versions.self !== selfVersion)
    return res.status(409).json({
      error: 'The self-assessment has changed. Start fresh to use the revised questionnaire.',
    });
  if (a.stage === 'self' || a.stage === 'quiz') {
    if (!publicContent[a.stage].every((q) => Object.hasOwn(a[a.stage as 'self' | 'quiz'], q.id)))
      throw new Error(
        a.stage === 'self'
          ? 'Rate every question or choose Not sure before submitting.'
          : 'Answer every question or choose Not sure before submitting.',
      );
    advance(a, a.stage === 'self' ? 'quiz' : 'learning');
  } else if (a.stage === 'learning') {
    if (!a.uploads.learning?.complete)
      throw new Error('Upload your complete learning transcript and confirm the preview.');
    advance(a, 'choice');
    void assessLearning(a.id);
  } else {
    if (!a.uploads.creation?.complete || !a.uploads.deliverable)
      throw new Error('Upload your deliverable and confirm your complete creation transcript.');
    a.job = { status: 'running', phase: 'Checking files', run: a.job.run + 1 };
    advance(a, 'processing');
    void evaluate(a.id);
  }
  res.json(view(a));
});
app.post('/api/pathway', owned, (req, res) => {
  const a = res.locals.attempt as Attempt;
  requireStage(a, 'choice');
  const pathway = z.enum(['essay', 'coding']).parse(req.body.pathway);
  if (a.pathway !== pathway) {
    delete a.uploads.creation;
    delete a.uploads.deliverable;
  }
  a.pathway = pathway;
  advance(a, 'creation');
  res.json(view(a));
});
app.post('/api/pathway/change', owned, (_req, res) => {
  const a = res.locals.attempt as Attempt;
  requireStage(a, 'creation');
  delete a.uploads.creation;
  delete a.uploads.deliverable;
  if (a.submissionModes) delete a.submissionModes.creation;
  a.pathway = null;
  advance(a, 'choice');
  res.json(view(a));
});
app.post('/api/upload/:slot', owned, uploads.single('file'), async (req, res) => {
  const a = res.locals.attempt as Attempt,
    slot = z.enum(['learning', 'creation', 'deliverable']).parse(req.params.slot);
  requireStage(a, slot === 'learning' ? 'learning' : 'creation');
  if (!req.file) throw new Error('Choose a file first.');
  const upload = await validateUpload(req.file.originalname, req.file.buffer, slot, a.pathway);
  const fresh = getAttempt(a.id)!;
  requireStage(fresh, slot === 'learning' ? 'learning' : 'creation');
  fresh.uploads[slot] = upload;
  if (slot !== 'deliverable') (fresh.submissionModes ||= {})[slot] = 'ai';
  saveOriginal(fresh, upload.id, req.file.buffer);
  saveAttempt(fresh);
  res.json(view(fresh));
});
app.post('/api/submission-mode/:slot', owned, (req, res) => {
  const a = res.locals.attempt as Attempt;
  const slot = z.enum(['learning', 'creation']).parse(req.params.slot);
  requireStage(a, slot === 'learning' ? 'learning' : 'creation');
  const mode = z.enum(['ai', 'no_ai']).parse(req.body.mode);
  const previous =
    a.submissionModes?.[slot] ?? (a.uploads[slot]?.kind === 'no_ai' ? 'no_ai' : 'ai');
  if (previous !== mode) delete a.uploads[slot];
  (a.submissionModes ||= {})[slot] = mode;
  saveAttempt(a);
  res.json(view(a));
});
app.post('/api/transcript/:slot', owned, async (req, res) => {
  const a = res.locals.attempt as Attempt;
  const slot = z.enum(['learning', 'creation']).parse(req.params.slot);
  requireStage(a, slot === 'learning' ? 'learning' : 'creation');
  const body = z
    .discriminatedUnion('method', [
      z.object({ method: z.literal('link'), url: z.string().trim().min(1).max(2048) }),
      z.object({ method: z.literal('no_ai'), text: z.string().trim().min(1).max(10000) }),
    ])
    .parse(req.body);
  let upload;
  let sourceHtml: string | undefined;
  if (body.method === 'link') {
    const page = await fetchSharedChat(body.url);
    upload = await sharedChatUpload(page.html, page.url);
    sourceHtml = page.html;
  } else {
    upload = await validateUpload(
      'How I worked without AI.txt',
      Buffer.from(body.text),
      slot,
      a.pathway,
    );
    upload.kind = 'no_ai';
    upload.turns = [];
    upload.text = body.text;
    upload.parseStatus = 'ready';
    delete upload.parsingNote;
    upload.complete = true;
  }
  const fresh = getAttempt(a.id);
  if (!fresh) return res.status(404).json({ error: 'Attempt not found.' });
  requireStage(fresh, slot === 'learning' ? 'learning' : 'creation');
  if (fresh.pathway !== a.pathway)
    throw new Error('The selected task changed. Import the conversation again.');
  fresh.uploads[slot] = upload;
  (fresh.submissionModes ||= {})[slot] = body.method === 'no_ai' ? 'no_ai' : 'ai';
  saveOriginal(fresh, upload.id, Buffer.from(upload.text));
  if (sourceHtml) saveOriginal(fresh, `${upload.id}.source.html`, Buffer.from(sourceHtml));
  saveAttempt(fresh);
  res.json(view(fresh));
});
app.patch('/api/upload/:slot', owned, (req, res) => {
  const a = res.locals.attempt as Attempt,
    slot = z.enum(['learning', 'creation']).parse(req.params.slot);
  requireStage(a, slot === 'learning' ? 'learning' : 'creation');
  if (!a.uploads[slot]) throw new Error('Upload the transcript first.');
  a.uploads[slot]!.complete = z.boolean().parse(req.body.complete);
  saveAttempt(a);
  res.json(view(a));
});
app.get('/api/upload/:slot', owned, (req, res) => {
  const a = res.locals.attempt as Attempt,
    slot = z.enum(['learning', 'creation', 'deliverable']).parse(req.params.slot),
    upload = a.uploads[slot];
  if (!upload) return res.status(404).json({ error: 'No upload found.' });
  res
    .type('application/octet-stream')
    .attachment(upload.name)
    .sendFile(path.join(dataDir, 'uploads', a.id, upload.id));
});
app.post('/api/evaluate/retry', owned, (_req, res) => {
  const a = res.locals.attempt as Attempt;
  requireStage(a, 'processing', 'results');
  if (a.job.status !== 'running') {
    a.job = { status: 'running', phase: 'Queued', run: a.job.run + 1 };
    advance(a, 'processing');
    void evaluate(a.id);
  }
  res.json(view(a));
});
app.post('/api/revise', owned, (_req, res) => {
  const a = res.locals.attempt as Attempt;
  requireStage(a, 'results');
  archiveReport(a);
  a.report = null;
  a.job = { status: 'idle', phase: '', run: a.job.run };
  advance(a, 'learning');
  res.json(view(a));
});
app.get('/api/review', admin, (_req, res) =>
  res.json(
    allAttempts()
      .filter((a) => a.report || a.job.status === 'error')
      .map((a) => ({
        id: a.id,
        name: nameOf(a.id),
        mode: a.mode,
        stage: a.stage,
        updatedAt: a.updatedAt,
        pending: a.report
          ? a.report.capabilities.filter((c) => c.observations.some((o) => o.status === 'pending'))
              .length + (a.report.deliverable.verdict === 'Pending' ? 1 : 0)
          : capabilities.length,
      })),
  ),
);
app.get('/api/review/:id', admin, (req, res) => {
  const a = getAttempt(String(req.params.id));
  if (!a) return res.status(404).json({ error: 'Attempt not found.' });
  res.json(view(a));
});
app.post('/api/review/:id', admin, async (req, res) => {
  const body = z
    .object({
      capability: z.string(),
      task: z.enum(['learning', 'creation']).optional(),
      score: z.number().min(0).max(1).nullable().optional(),
      verdict: z.enum(['Pass', 'Fail', 'Pending']).optional(),
      reason: z.string().trim().min(10).max(2000),
    })
    .parse(req.body);
  const a = getAttempt(String(req.params.id));
  if (!a?.report || a.stage !== 'results')
    throw new Error('Only finished results can be adjudicated.');
  if (a.job.status === 'running')
    throw new Error('Wait for assessment processing to finish before reviewing.');
  if (!capabilities.some((c) => c.id === body.capability)) throw new Error('Unknown capability.');
  const observations = structuredClone(a.report.capabilities.flatMap((c) => c.observations)),
    deliverable = structuredClone(a.report.deliverable);
  let previous: unknown;
  if (body.capability === 'C5') {
    if (!body.verdict) throw new Error('Select a deliverable verdict.');
    if (
      body.verdict === 'Pass' &&
      (deliverable.checks.code as { status?: string } | null)?.status === 'Fail'
    )
      throw new Error(
        'A failed deterministic code check cannot be overridden as Pass. Request a corrected submission.',
      );
    previous = JSON.parse(JSON.stringify(deliverable));
    deliverable.verdict = body.verdict;
    deliverable.criteria = [
      {
        id: 'human-review',
        label: 'Human adjudication',
        verdict: body.verdict,
        reason: body.reason,
      },
    ];
  } else {
    const o = observations.find((o) => o.capability === body.capability && o.task === body.task);
    if (!o || body.score === undefined) throw new Error('Select an observed capability and task.');
    previous = JSON.parse(JSON.stringify(o));
    o.score = body.score;
    o.status = body.score === null ? 'absent' : 'scored';
    o.reason = `Human review: ${body.reason}`;
  }
  if (body.capability === 'C5' && a.assessments?.deliverable)
    a.assessments.deliverable.result = deliverable;
  if (body.task && a.assessments?.[body.task])
    a.assessments[body.task]!.result = observations.filter((o) => o.task === body.task);
  archiveReport(a);
  a.report.audit.push({
    at: new Date().toISOString(),
    reason: body.reason,
    capability: body.capability,
    previous,
    next: body,
  });
  const report = calculateReport(a, observations, deliverable);
  await populateSummaries(a, report, nameOf(a.id));
  a.report = report;
  saveAttempt(a);
  writeRunExport(a, nameOf(a.id), path.join(dataDir, 'uploads'));
  res.json(view(a));
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use(
  (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError)
      return res
        .status(400)
        .json({ error: 'Please check the required fields and selected values.' });
    if (error instanceof multer.MulterError)
      return res.status(400).json({ error: 'Upload one file at a time, no larger than 10 MB.' });
    const err = error as Error & { status?: number };
    res
      .status(err.status || 400)
      .json({ error: err.message || 'Something went wrong. Your saved work is still available.' });
  },
);

for (const a of allAttempts())
  if (Date.now() - Date.parse(a.createdAt) > 30 * 86400000 && a.job.status !== 'running')
    deleteAttempt(a);
const root = fileURLToPath(new URL('..', import.meta.url));
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(root, 'dist')));
  app.use('/assets', (_req, res) => res.status(404).send('Asset not found. Reload the page.'));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    configFile: path.join(root, 'vite.config.ts'),
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}
const server = createServer(app);
let port = Number(process.env.PORT || 4173);
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    port++;
    server.listen(port, '127.0.0.1');
  } else throw error;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`AI Competency: http://localhost:${port} (${mode} mode)`);
  console.log('Local reviewer token: .data/reviewer-token (or ADMIN_TOKEN in .env).');
});
