import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Attempt, Mode } from '../shared/types.js';
import {
  contentFingerprint,
  questionnaireFingerprint,
  selfVersion,
  quizVersion,
} from './content.js';
import { SCORING_VERSION } from './prompts.js';
import { initializeQuizOrder } from './quiz-order.js';

export const dataDir = path.resolve(process.env.DATA_DIR || '.data');
fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(path.join(dataDir, 'assessment.sqlite'));
db.exec(
  'PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS identities(id TEXT PRIMARY KEY, name TEXT NOT NULL); CREATE TABLE IF NOT EXISTS result_history(id INTEGER PRIMARY KEY, attempt TEXT NOT NULL, recorded_at TEXT NOT NULL, body TEXT NOT NULL);',
);
export const digest = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const tokenFile = path.join(dataDir, 'reviewer-token');
if (!process.env.ADMIN_TOKEN && !fs.existsSync(tokenFile))
  fs.writeFileSync(tokenFile, randomBytes(32).toString('hex'), { mode: 0o600 });
const adminToken = process.env.ADMIN_TOKEN || fs.readFileSync(tokenFile, 'utf8').trim();
export const isAdmin = (token: string) =>
  timingSafeEqual(Buffer.from(digest(token)), Buffer.from(digest(adminToken)));
export function createAttempt(name: string, mode: Mode) {
  const now = new Date().toISOString(),
    id = randomUUID(),
    token = randomBytes(32).toString('hex');
  const attempt: Attempt = {
    id,
    stage: 'self',
    mode,
    consent: true,
    createdAt: now,
    updatedAt: now,
    self: {},
    quiz: {},
    cursor: { self: 0, quiz: 0 },
    pathway: null,
    uploads: {},
    stageStarted: {},
    job: { status: 'idle', phase: '', run: 0 },
    report: null,
    versions: {
      self: selfVersion,
      quiz: quizVersion,
      scoring: SCORING_VERSION,
      content: contentFingerprint,
      questionnaire: questionnaireFingerprint,
    },
  };
  initializeQuizOrder(attempt);
  db.prepare('INSERT INTO attempts VALUES (?, ?, ?)').run(
    id,
    digest(token),
    JSON.stringify(attempt),
  );
  db.prepare('INSERT INTO identities VALUES (?, ?)').run(id, name);
  return { attempt, token };
}
export function getAttempt(id: string) {
  const r = db.prepare('SELECT body FROM attempts WHERE id=?').get(id) as
    { body: string } | undefined;
  return r ? (JSON.parse(r.body) as Attempt) : null;
}
export function fromToken(token: string) {
  const r = db.prepare('SELECT body FROM attempts WHERE token_hash=?').get(digest(token)) as
    { body: string } | undefined;
  return r ? (JSON.parse(r.body) as Attempt) : null;
}
export function nameOf(id: string) {
  return (
    (db.prepare('SELECT name FROM identities WHERE id=?').get(id) as { name: string } | undefined)
      ?.name || ''
  );
}
export function saveAttempt(a: Attempt) {
  a.updatedAt = new Date().toISOString();
  db.prepare('UPDATE attempts SET body=? WHERE id=?').run(JSON.stringify(a), a.id);
}
export function allAttempts(): Attempt[] {
  return (
    db.prepare('SELECT body FROM attempts ORDER BY rowid DESC').all() as { body: string }[]
  ).map((r) => JSON.parse(r.body));
}
export function archiveReport(a: Attempt) {
  if (a.report)
    db.prepare('INSERT INTO result_history(attempt,recorded_at,body) VALUES (?,?,?)').run(
      a.id,
      new Date().toISOString(),
      JSON.stringify(a.report),
    );
}
export function deleteAttempt(a: Attempt) {
  // Submitted research archives are permanent; only operational session data is removed.
  db.prepare('DELETE FROM result_history WHERE attempt=?').run(a.id);
  db.prepare('DELETE FROM attempts WHERE id=?').run(a.id);
  db.prepare('DELETE FROM identities WHERE id=?').run(a.id);
  fs.rmSync(path.join(dataDir, 'uploads', a.id), { recursive: true, force: true });
}
export function saveOriginal(a: Attempt, id: string, data: Buffer) {
  const dir = path.join(dataDir, 'uploads', a.id);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, id), data, { mode: 0o600 });
}
// An interrupted provider call never leaves an attempt stuck in Processing.
for (const a of allAttempts())
  if (a.job.status === 'running') {
    a.job.status = 'error';
    a.job.error = 'The server restarted. Retry to resume evaluation.';
    saveAttempt(a);
  }
