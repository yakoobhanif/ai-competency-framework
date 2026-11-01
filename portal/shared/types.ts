export type Stage = 'self' | 'quiz' | 'learning' | 'choice' | 'creation' | 'processing' | 'results';
export type Pathway = 'essay' | 'coding';
export type Mode = 'demo' | 'live';
export type SelfValue = number | 'not_sure';
export type QuizValue = 'A' | 'B' | 'C' | 'D' | 'not_sure';
export type Slot = 'learning' | 'creation' | 'deliverable';
export type Turn = {
  id: string;
  role: 'student' | 'assistant' | 'tool';
  text: string;
  unavailableContent?: boolean;
};
export type Upload = {
  id: string;
  name: string;
  size: number;
  hash: string;
  text: string;
  turns: Turn[];
  words: number;
  complete: boolean;
  extension: string;
  sourceUrl?: string;
  importedAt?: string;
  kind?: 'transcript' | 'no_ai';
  parseStatus?: 'ready' | 'needs_review';
  parsingNote?: string;
  sourceHash?: string;
  parserVersion?: string;
};
export type Observation = {
  capability: string;
  task: 'learning' | 'creation';
  status: 'scored' | 'absent' | 'pending';
  /** NOUL probability, on a 0–1 scale. */
  score: number | null;
  reason: string;
  model?: string;
  raw?: unknown;
};
export type Criterion = {
  id: string;
  label: string;
  verdict: 'Pass' | 'Fail' | 'Pending';
  reason: string;
  probability?: number;
  raw?: unknown;
};
export type Deliverable = {
  verdict: 'Pass' | 'Fail' | 'Pending';
  criteria: Criterion[];
  checks: Record<string, unknown>;
};
export type CapabilityResult = {
  id: string;
  name: string;
  domain: string;
  score: number | null;
  quiz: number | null;
  self: number | null;
  adjustment: number | null;
  observations: Observation[];
};
export type Feedback = {
  paragraphs: string[];
  source: 'llm' | 'fallback' | 'demo';
  model?: string;
};
export type AssessmentCache<T> = {
  inputHash: string;
  result: T;
  completedAt: string;
  promptVersion: string;
  model: string;
};
export type ProfileView = 'quiz' | 'learning' | 'creation' | 'both';
export type SummaryKey = ProfileView | `${ProfileView}-self`;
export type SkillBand = 'Developing' | 'Established' | 'Strong' | 'Insufficient evidence';
export type Profile = {
  id: ProfileView;
  capabilities: {
    id: string;
    score: number | null;
    quiz: number | null;
    practical: number | null;
    adjustment: number | null;
    pending: boolean;
  }[];
  dimensions: {
    id: string;
    name: string;
    short: string;
    score: number | null;
    band: SkillBand;
    coverage: number;
    count: number;
    self: number | null;
    pending: boolean;
    adjusted: number;
  }[];
};
export type Report = {
  mode: Mode;
  version: string;
  createdAt: string;
  pathway: Pathway;
  capabilities: CapabilityResult[];
  deliverable: Deliverable;
  feedback: Feedback;
  views?: Record<ProfileView, Profile>;
  summaries?: Partial<Record<SummaryKey, Feedback>>;
  summaryFingerprint?: string;
  commentary?: { status: 'pending' | 'complete'; completed: number; total: number };
  diagnostics?: {
    component: string;
    code: string;
    status?: number;
    requestId?: string;
    at: string;
  }[];
  audit: { at: string; reason: string; capability: string; previous: unknown; next: unknown }[];
};
export type Attempt = {
  id: string;
  stage: Stage;
  mode: Mode;
  createdAt: string;
  updatedAt: string;
  self: Record<string, SelfValue>;
  quiz: Record<string, QuizValue>;
  quizOrder?: string[];
  cursor: { self: number; quiz: number };
  reviewReached?: Partial<Record<'self' | 'quiz', boolean>>;
  pathway: Pathway | null;
  uploads: Partial<Record<Slot, Upload>>;
  submissionModes?: Partial<Record<'learning' | 'creation', 'ai' | 'no_ai'>>;
  stageStarted: Record<string, string>;
  job: {
    status: 'idle' | 'running' | 'error' | 'complete';
    phase: string;
    error?: string;
    run: number;
  };
  report: Report | null;
  assessments?: {
    learning?: AssessmentCache<Observation[]>;
    creation?: AssessmentCache<Observation[]>;
    deliverable?: AssessmentCache<Deliverable>;
  };
  consent: boolean;
  versions: Record<string, string>;
};
export type StudentAttempt = Attempt & { name: string };
export type Question = {
  id: string;
  title: string;
  prompt: string;
  note?: string;
  selfDescriptions?: string[];
  options?: { id: string; text: string; summary: string }[];
};
export type PublicContent = {
  self: Question[];
  quiz: Question[];
  briefs: Record<'learning' | Pathway, string>;
  codingProblem: string;
  domains: { id: string; name: string; short: string }[];
  capabilities: {
    id: string;
    name: string;
    domain: string;
    description: string;
  }[];
};
