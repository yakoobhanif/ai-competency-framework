import { assessmentPalette } from './palette';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  FileText,
  LoaderCircle,
  Pause,
  Play,
  ScanLine,
  UploadCloud,
  X,
  BookOpen,
  ShieldCheck,
  Download,
  RotateCcw,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { PublicContent, StudentAttempt, Slot, SelfValue, QuizValue } from '../../shared/types';
import { api } from './api';
import { orderedQuizQuestions } from '../../shared/quiz-order';
import Results from './Results';
const LightField = lazy(() => import('./LightField'));
const PdfViewer = lazy(() => import('./PdfViewer'));
const ProblemStatement = lazy(() => import('./ProblemStatement'));
const Review = lazy(() => import('./Review'));
const StudyVision = lazy(() => import('./StudyVision'));

type Config = {
  mode: 'demo' | 'live';
  selfVersion: string;
  quizVersion: string;
  questionnaireFingerprint: string;
};
const stages = ['Self-assessment', 'Capability quiz', 'Learning task', 'Creation task'];
const descriptions = [
  'Reflect on your current capabilities.',
  'Put your AI knowledge into practice.',
  'Show how you learn with AI.',
  'Show how you create with AI.',
];
const selfLabels = ['Not at all', 'Slightly', 'Moderately', 'Well', 'Very well'];

function Mark() {
  return (
    <>
      <ScanLine size={25} strokeWidth={1.5} />
      <span>AI COMPETENCY FRAMEWORK</span>
    </>
  );
}
function Progress({ stage }: { stage: StudentAttempt['stage'] }) {
  const current =
    stage === 'self'
      ? 0
      : stage === 'quiz'
        ? 1
        : stage === 'learning'
          ? 2
          : stage === 'results' || stage === 'processing'
            ? 4
            : 3;
  return (
    <nav className="steps" aria-label="Assessment progress">
      {stages.map((s, i) => (
        <div
          className={`step ${i === current ? 'active' : i < current ? 'complete' : ''}`}
          key={s}
          aria-current={i === current ? 'step' : undefined}
        >
          <span>{i < current ? <Check size={13} /> : `0${i + 1}`}</span>
          <strong>{s}</strong>
        </div>
      ))}
    </nav>
  );
}
function Timer({ since, estimate }: { since: string; estimate: number }) {
  const remaining = () =>
    Math.max(0, Math.ceil((Date.parse(since) + estimate * 60000 - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(remaining);
  useEffect(() => {
    const tick = () => setSeconds(remaining());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since, estimate]);
  return (
    <span
      className={`timer${seconds === 0 ? ' timer-expired' : ''}`}
      role="timer"
      aria-live="off"
      aria-label={
        seconds === 0 ? 'Suggested time reached. You can keep going.' : 'Suggested time remaining'
      }
      title="For guidance only. You can continue after the timer reaches zero."
    >
      <Clock3 size={15} />
      <span className="timer-digits">
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </span>
    </span>
  );
}

export default function App() {
  const [content, setContent] = useState<PublicContent | null>(null),
    [config, setConfig] = useState<Config | null>(null),
    [attempt, setAttempt] = useState<StudentAttempt | null>(null);
  const [screen, setScreen] = useState<'home' | 'overview' | 'flow' | 'vision'>(() =>
    location.pathname === '/vision'
      ? 'vision'
      : sessionStorage.getItem('assessment-screen') === 'flow'
        ? 'flow'
        : 'home',
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [name, setName] = useState(''),
    [consent, setConsent] = useState(false);
  const isReview = location.pathname === '/review';
  const load = async () => {
    try {
      const c = await api<PublicContent>('/content');
      const cfg = await api<Config>('/config');
      const a = await api<StudentAttempt | null>('/attempt');
      setContent(c);
      setConfig(cfg);
      setAttempt(a);
      if (!a && screen === 'flow') setScreen('home');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!isReview) history.replaceState(null, '', screen === 'vision' ? '/vision' : '/');
    sessionStorage.setItem('assessment-screen', screen === 'flow' ? 'flow' : 'home');
    window.scrollTo(0, 0);
    const h = document.querySelector<HTMLElement>('h1');
    h?.focus({ preventScroll: true });
  }, [screen, attempt?.stage]);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setPaused(mq.matches);
    mq.addEventListener('change', change);
    return () => mq.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!attempt || (attempt.stage !== 'processing' && attempt.stage !== 'results')) return;
    const timer = setInterval(
      () => {
        api<StudentAttempt>('/attempt')
          .then((a) => {
            if (a) setAttempt(a);
          })
          .catch(() => {});
      },
      attempt.stage === 'processing' ? 1500 : 8000,
    );
    return () => clearInterval(timer);
  }, [attempt?.stage, attempt?.id]);

  async function act<T>(work: () => Promise<T>) {
    setBusy(true);
    setError('');
    try {
      return await work();
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  async function update(url: string, body?: unknown, method = 'POST') {
    return act(async () => {
      const a = await api<StudentAttempt>(url, {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      setAttempt(a);
      return a;
    });
  }
  const upload = (slot: Slot, file: File) =>
    act(async () => {
      const data = new FormData();
      data.append('file', file);
      const a = await api<StudentAttempt>(`/upload/${slot}`, { method: 'POST', body: data });
      setAttempt(a);
    });
  const start = () => {
    setScreen('overview');
  };
  const startFresh = () => {
    if (
      busy ||
      (attempt &&
        !confirm(
          'Start fresh? This will clear your current assessment session and return to the homepage. Submitted research records will be retained.',
        ))
    )
      return;
    void act(async () => {
      if (attempt) await api('/attempt', { method: 'DELETE' });
      sessionStorage.removeItem('assessment-screen');
      window.location.replace('/');
    });
  };
  const remove = () => {
    if (
      confirm(
        'Delete this assessment session? Submitted research records will be retained. This cannot be undone.',
      )
    )
      void act(async () => {
        await api('/attempt', { method: 'DELETE' });
        setAttempt(null);
        setScreen('home');
      });
  };
  if (loading)
    return (
      <main className="loading-screen">
        <ScanLine size={40} />
        <p>Opening your assessment</p>
      </main>
    );
  if (!content || !config)
    return (
      <main className="fatal">
        <h1>Unable to connect</h1>
        <p role="alert">{error}</p>
        <button
          className="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
        >
          Retry
          <RotateCcw size={17} />
        </button>
      </main>
    );
  if (isReview)
    return (
      <Suspense fallback={<main className="loading-screen">Opening reviewer workspace</main>}>
        <Review />
      </Suspense>
    );

  const dark = screen === 'home' || screen === 'vision';
  const environmentControls = (
    <div className="footer-environment">
      {attempt && (
        <button className="text-button" onClick={startFresh} disabled={busy}>
          Start fresh
        </button>
      )}
      <span>{config.mode === 'demo' ? 'Demo environment' : 'Local research pilot'}</span>
    </div>
  );
  return (
    <div
      className={`${dark ? 'app dark' : 'app'}${screen === 'flow' && attempt?.stage === 'results' ? ' results-shell' : ''}`}
      style={assessmentPalette}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="header">
        <button className="brand" onClick={() => setScreen('home')} aria-label="AI Competency home">
          <Mark />
        </button>
        <div className="header-end">
          <span className="project-label">
            AI4SG Lab <span>/</span> NUS
          </span>
          <span className={`mode-badge ${config.mode}`}>
            {config.mode === 'demo' ? 'Demo mode' : 'Local pilot'}
          </span>
          {dark && (
            <button
              className="icon-button"
              title={paused ? 'Play installation' : 'Pause installation'}
              aria-label={paused ? 'Play installation' : 'Pause installation'}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
          )}
        </div>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            className="icon-button"
            title="Dismiss error"
            aria-label="Dismiss error"
            onClick={() => setError('')}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {screen === 'home' && (
        <main id="main">
          <section className="entrance">
            <Suspense fallback={<div className="light-field" />}>
              <LightField paused={paused} />
            </Suspense>
            <div className="hero-copy">
              <div className="eyebrow">Human intelligence. New possibilities.</div>
              <h1 tabIndex={-1}>
                AI
                <br />
                competency
              </h1>
              <p>
                Discover how you understand,
                <br className="desktop-only" /> learn and create with AI.
              </p>
              <div className="hero-actions">
                <button
                  className="button white"
                  onClick={attempt ? () => setScreen('flow') : start}
                >
                  {attempt ? 'Resume assessment' : 'Start assessment'}
                  <ArrowRight size={21} />
                </button>
                <a className="text-button" href="/vision">
                  Explore the study
                  <ArrowUpRight size={17} />
                </a>
              </div>
              <div className="hero-footnote">
                <Clock3 size={14} />
                About 60 minutes <span>·</span> Four activities
              </div>
            </div>
            <div className="installation-caption">
              <span>AN EXPLORATION</span>
              <span>Where human & machine meet</span>
            </div>
          </section>
          <section className="entrance-strip" aria-label="Assessment activities">
            {stages.map((s, i) => (
              <div key={s}>
                <span className="strip-number">0{i + 1}</span>
                <div>
                  <h2>{s}</h2>
                  <span>{[7, 20, 20, 20][i]} min</span>
                </div>
                <ArrowUpRight size={18} />
              </div>
            ))}
          </section>
          <footer className="entrance-footer">
            <span>Design and evaluation of AI competency · FT5007</span>
            {environmentControls}
          </footer>
        </main>
      )}

      {screen === 'overview' && (
        <main id="main" className="content overview">
          <div className="eyebrow">Before we begin</div>
          <h1 tabIndex={-1}>Your AI skills, in practice.</h1>
          <p className="lead">Four activities to build a picture of how you work with AI.</p>
          <div className="overview-layout">
            <div className="activity-list">
              {stages.map((s, i) => (
                <div className="activity-row" key={s}>
                  <span className="row-index">0{i + 1}</span>
                  <div>
                    <h2>{s}</h2>
                    <p>{descriptions[i]}</p>
                  </div>
                  <span className="duration">{[7, 20, 20, 20][i]} min</span>
                </div>
              ))}
              <div className="time-note">
                <Clock3 size={18} />
                <p>
                  Plan for about an hour. You have up to one extra hour for the tasks: 20 minutes
                  for learning and 40 for creation. There is no speed score.
                </p>
              </div>
            </div>
            <form
              className="identity-form"
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  const a = await api<StudentAttempt>('/attempt', {
                    method: 'POST',
                    body: JSON.stringify({ name, consent }),
                  });
                  setAttempt(a);
                  setScreen('flow');
                });
              }}
            >
              <label htmlFor="student-name">What should we call you?</label>
              <input
                id="student-name"
                autoComplete="given-name"
                maxLength={100}
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                />
                <span>I agree to the processing of my assessment responses and task files.</span>
              </label>
              <p className="caption privacy">
                {config.mode === 'demo'
                  ? 'Demo: files stay on this local server. Quiz scores are real, but practical results are illustrative. No submissions are sent to AI providers.'
                  : 'Live: de-identified task content is sent to TypeSafe for grading and Anthropic for commentary. Uploaded work is private to this session and the local reviewer.'}
              </p>
              <button className="button wide" disabled={!name.trim() || !consent || busy}>
                {busy ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight size={19} />
                  </>
                )}
              </button>
              <button type="button" className="text-button" onClick={() => setScreen('home')}>
                <ArrowLeft size={16} />
                Back
              </button>
            </form>
          </div>
        </main>
      )}

      {screen === 'flow' && attempt && (
        <>
          {attempt.stage !== 'results' && (
            <div className="content">
              <Progress stage={attempt.stage} />
            </div>
          )}
          {(attempt.stage === 'self' || attempt.stage === 'quiz') &&
            (attempt.versions.questionnaire !== config.questionnaireFingerprint ? (
              <main id="main" className="question-shell">
                <h1>The assessment has been updated.</h1>
                <p>Start fresh to answer the revised questionnaire without mixing versions.</p>
              </main>
            ) : attempt.stage === 'self' && !attempt.stageStarted.self ? (
              <main id="main" className="question-shell assessment-intro">
                <div className="intro-heading">
                  <span className="eyebrow">01 / Self-assessment</span>
                  <h1 tabIndex={-1}>Before you begin.</h1>
                  <p className="lead">A moment to reflect on your AI skills.</p>
                  <div className="intro-details">
                    <span>
                      <BookOpen size={17} />
                      {content.self.length} questions
                    </span>
                    <span>
                      <Clock3 size={17} />
                      About 7 minutes
                    </span>
                  </div>
                </div>
                <div className="intro-content">
                  <div className="intro-body">
                    <p>
                      When you select <strong>Let's begin</strong>, your self-assessment will start.
                    </p>
                    <p>
                      Choose the answer that feels closest to your current ability. You can only
                      choose one option. Trust your first impression and try not to spend too long
                      on each question.
                    </p>
                    <p>
                      Still, the timer is just a guide, so don't worry if you need more time. You
                      can take as long as you need.
                    </p>
                    <p>Answer on your own, without AI, searches or other external tools.</p>
                    <p>
                      At the end, you'll see a summary of your answers and can review or change them
                      before moving to the next part.
                    </p>
                  </div>
                  <div className="intro-actions">
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void update('/self/start')}
                    >
                      Let's begin <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              </main>
            ) : attempt.stage === 'quiz' && !attempt.stageStarted.quiz ? (
              <main id="main" className="question-shell assessment-intro">
                <div className="intro-heading">
                  <span className="eyebrow">02 / Capability quiz</span>
                  <h1 tabIndex={-1}>Ready for the next task?</h1>
                  <p className="lead">Put your AI knowledge into practice.</p>
                  <div className="intro-details">
                    <span>
                      <BookOpen size={17} />
                      {content.quiz.length} questions
                    </span>
                    <span>
                      <Clock3 size={17} />
                      About 20 minutes
                    </span>
                  </div>
                </div>
                <div className="intro-content">
                  <div className="intro-body">
                    <p>
                      Your self-assessment is complete. The next task will now check your AI
                      knowledge and judgement through a quiz involving practical scenarios.
                    </p>
                    <p>
                      Choose one answer for each question. Some options may be partly reasonable, so
                      choose the one that best fits the situation.
                    </p>
                    <p>If you're unsure, select &quot;Not sure&quot; rather than guessing.</p>
                    <p>Work on your own, without AI, searches, notes or help from someone else.</p>
                    <p>
                      Again, the timer is just a guide, so take the time you need. You'll be able to
                      review and change your answers before submitting.
                    </p>
                  </div>
                  <div className="intro-actions">
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void update('/quiz/start')}
                    >
                      Start quiz <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              </main>
            ) : (
              <Questionnaire
                key={attempt.stage}
                attempt={attempt}
                content={content}
                busy={busy}
                update={update}
              />
            ))}
          {attempt.stage === 'learning' &&
            (!attempt.stageStarted.learning ? (
              <main id="main" className="question-shell assessment-intro">
                <div className="intro-heading">
                  <span className="eyebrow">03 / Learning task</span>
                  <h1 tabIndex={-1}>Now, let's work with AI.</h1>
                </div>
                <div className="intro-content">
                  <div className="intro-body">
                    <p>
                      Your self-assessment and quiz are complete. Next, you'll move on to two
                      practical tasks using generative AI.
                    </p>
                    <p>
                      First, you'll be asked to study a topic with AI. Then, you'll use AI to create
                      a simple project.
                    </p>
                    <p>
                      In both cases you'll be asked to share a transcript of your conversation with
                      the AI, together with the output of the project in the second case.
                    </p>
                    <p>
                      There are no right or wrong answers here. We simply want to understand more
                      deeply how you use generative AI for your university work.
                    </p>
                  </div>
                  <div className="intro-actions">
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void update('/learning/start')}
                    >
                      Continue to learning task <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              </main>
            ) : (
              <TaskPage
                attempt={attempt}
                content={content}
                busy={busy}
                update={update}
                upload={upload}
                learning
              />
            ))}
          {attempt.stage === 'choice' && (
            <main id="main" className="content pathway">
              <div className="eyebrow">04 / Creation task</div>
              <h1 tabIndex={-1}>
                Two paths.
                <br />
                Your choice.
              </h1>
              <p className="lead">
                Choose the kind of work you would like to create with AI.
                <br />
                Both explore how you direct, develop and evaluate a result.
              </p>
              <div className="pathways">
                <button
                  className="pathway-option"
                  disabled={busy}
                  onClick={() => void update('/pathway', { pathway: 'essay' })}
                >
                  <FileText size={32} strokeWidth={1.3} />
                  <span className="eyebrow">Any major</span>
                  <h2>Make an argument.</h2>
                  <p>Do recommendation algorithms shape our preferences, or mainly learn them?</p>
                  <div className="pathway-facts">
                    <span>Essay · up to 1,000 words</span>
                    <span>20 min + 40 min buffer</span>
                  </div>
                  <span className="choose-path">
                    Choose essay
                    <ArrowRight size={20} />
                  </span>
                </button>
                <button
                  className="pathway-option"
                  disabled={busy}
                  onClick={() => void update('/pathway', { pathway: 'coding' })}
                >
                  <Code2 size={32} strokeWidth={1.3} />
                  <span className="eyebrow">Introductory programmers</span>
                  <h2>Solve a problem.</h2>
                  <p>Find an elegant solution to Gifts Fixing, a compact programming challenge.</p>
                  <div className="pathway-facts">
                    <span>One Python 3 file</span>
                    <span>20 min + 40 min buffer</span>
                  </div>
                  <span className="choose-path">
                    Choose coding
                    <ArrowRight size={20} />
                  </span>
                </button>
              </div>
            </main>
          )}
          {attempt.stage === 'creation' && (
            <TaskPage
              attempt={attempt}
              content={content}
              busy={busy}
              update={update}
              upload={upload}
            />
          )}
          {attempt.stage === 'processing' && (
            <main id="main" className="content processing">
              <div className="processing-symbol">
                <ScanLine
                  size={70}
                  strokeWidth={1}
                  className={attempt.job.status === 'running' ? 'breathe' : ''}
                />
              </div>
              <span className="eyebrow">Bringing the evidence together</span>
              <h1 tabIndex={-1}>
                {attempt.job.status === 'error'
                  ? 'Your work is saved.'
                  : 'A picture is taking shape.'}
              </h1>
              <p className="lead">
                {attempt.job.status === 'error' ? attempt.job.error : attempt.job.phase}
              </p>
              {attempt.job.status === 'running' ? (
                <div className="processing-track">
                  <span />
                </div>
              ) : (
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void update('/evaluate/retry')}
                >
                  Retry evaluation
                  <RotateCcw size={18} />
                </button>
              )}
              <p className="caption">
                You can leave and return to this browser. Your submitted files are saved.
              </p>
              {config.mode === 'demo' && (
                <p className="demo-disclaimer">
                  Demo mode: practical results will be illustrative.
                </p>
              )}
            </main>
          )}
          {attempt.stage === 'results' && attempt.report && (
            <Results
              report={attempt.report}
              name={attempt.name}
              onBack={() => setScreen('home')}
              onDelete={remove}
              onRevise={() => {
                if (
                  confirm(
                    'Reopen task uploads? Current results will be archived and a new scoring run will be created when you resubmit.',
                  )
                )
                  void update('/revise');
              }}
              onRetry={() => {
                if (
                  confirm('Re-evaluate the submitted files? Live mode may incur provider charges.')
                )
                  void update('/evaluate/retry');
              }}
            />
          )}
        </>
      )}
      {screen === 'vision' && (
        <Suspense
          fallback={
            <main id="main" className="content">
              <p>Loading the study...</p>
            </main>
          }
        >
          <StudyVision
            paused={paused}
            onStart={attempt ? () => setScreen('flow') : start}
            hasAttempt={!!attempt}
          />
        </Suspense>
      )}
      {screen !== 'home' && (
        <footer className="footer">
          <span>
            AI4SG Lab / NUS <span className="muted">· FT5007</span>
          </span>
          {environmentControls}
        </footer>
      )}
    </div>
  );
}

type Update = (url: string, body?: unknown, method?: string) => Promise<StudentAttempt | undefined>;
function Questionnaire({
  attempt,
  content,
  busy,
  update,
}: {
  attempt: StudentAttempt;
  content: PublicContent;
  busy: boolean;
  update: Update;
}) {
  const stage = attempt.stage as 'self' | 'quiz',
    questions =
      stage === 'quiz' ? orderedQuizQuestions(content.quiz, attempt.quizOrder) : content.self;
  const [index, setIndex] = useState(Math.min(attempt.cursor[stage], questions.length));
  const [pendingAnswer, setPendingAnswer] = useState<{
    id: string;
    value: SelfValue | QuizValue;
  } | null>(null);
  const self = stage === 'self',
    q = questions[index],
    answers = attempt[stage];
  const hasReachedReview =
    attempt.reviewReached?.[stage] || attempt.cursor[stage] === questions.length;
  const navigate = async (nextIndex: number) => {
    const a = await update(
      '/answers',
      { stage, id: q.id, value: answers[q.id], cursor: nextIndex },
      'PATCH',
    );
    if (a) setIndex(nextIndex);
  };
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>('.question-shell h1')?.focus({ preventScroll: true });
  }, [index]);
  if (!q)
    return (
      <main id="main" className="question-shell">
        <span className="eyebrow">{self ? 'Self-assessment' : 'Capability quiz'} / Review</span>
        <Timer since={attempt.stageStarted[stage]} estimate={self ? 7 : 20} />
        <h1 tabIndex={-1}>Ready to move on?</h1>
        <p className="muted">Review your responses. Once submitted, this stage is complete.</p>
        <div className={`answer-review ${self ? '' : 'quiz-answer-review'}`}>
          {questions.map((q, i) => (
            <button key={q.id} onClick={() => setIndex(i)}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <span>{q.title}</span>
              <strong>
                {answers[q.id] === 'not_sure'
                  ? 'Not sure'
                  : self
                    ? selfLabels[Number(answers[q.id]) - 1] || 'Unanswered'
                    : q.options?.find((o) => o.id === answers[q.id])?.summary || 'Unanswered'}
              </strong>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
        <div className="question-nav">
          <button className="text-button" onClick={() => setIndex(questions.length - 1)}>
            <ArrowLeft size={17} />
            Back
          </button>
          <button
            className="button"
            disabled={busy || questions.some((q) => !Object.hasOwn(answers, q.id))}
            onClick={() => void update('/stage/submit')}
          >
            Submit {self ? 'self-assessment' : 'quiz'}
            <ArrowRight size={18} />
          </button>
        </div>
      </main>
    );
  const options = self
    ? selfLabels.map((text, i) => ({ id: i + 1, text, hint: q.selfDescriptions![i] }))
    : q.options!.map((o) => ({ ...o, hint: '' }));
  const select = async (value: SelfValue | QuizValue) => {
    setPendingAnswer({ id: q.id, value });
    await update('/answers', { stage, id: q.id, value, cursor: index }, 'PATCH');
    setPendingAnswer(null);
  };
  const selectedValue = pendingAnswer?.id === q.id ? pendingAnswer.value : answers[q.id];
  return (
    <main id="main" className="question-shell">
      <div className="question-top">
        <span className="eyebrow">
          {String(index + 1).padStart(2, '0')} / {questions.length}
        </span>
        <div className="question-status">
          <Timer since={attempt.stageStarted[stage]} estimate={self ? 7 : 20} />
          <span className="save-status" role="status">
            {busy ? (
              'Saving'
            ) : (
              <>
                <Check size={13} />
                Saved
              </>
            )}
          </span>
        </div>
      </div>
      <div
        className="question-progress"
        role="progressbar"
        aria-valuenow={index}
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-label="Questions completed"
      >
        <span style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>
      <h1 className="question-title" tabIndex={-1}>
        {q.prompt}
      </h1>
      <fieldset className={`answer-options ${self ? 'self-options' : ''}`}>
        <legend className="sr-only">Choose your answer</legend>
        {options.map((o) => (
          <label key={o.id} className={`answer-option ${selectedValue === o.id ? 'selected' : ''}`}>
            <input
              type="radio"
              name="answer"
              value={o.id}
              checked={selectedValue === o.id}
              disabled={busy}
              onChange={() => void select(o.id as SelfValue | QuizValue)}
            />
            <span className="option-index">{self ? o.id : o.id}</span>
            <span className="option-copy">
              <strong>{o.text}</strong>
              {o.hint && <small>{o.hint}</small>}
            </span>
            <span className="radio-indicator">{selectedValue === o.id && <Check size={14} />}</span>
          </label>
        ))}
      </fieldset>
      <div className="question-nav">
        <button
          className="icon-button bordered"
          title="Previous question"
          aria-label="Previous question"
          disabled={index === 0 || busy}
          onClick={() => setIndex(index - 1)}
        >
          <ArrowLeft size={19} />
        </button>
        <div className="question-secondary">
          <button
            className={`text-button ${selectedValue === 'not_sure' ? 'chosen' : ''}`}
            aria-pressed={selectedValue === 'not_sure'}
            disabled={busy}
            onClick={() => void select('not_sure')}
          >
            Not sure
          </button>
        </div>
        <button
          className="button"
          disabled={busy || !Object.hasOwn(answers, q.id)}
          onClick={() => void navigate(index + 1)}
        >
          {index === questions.length - 1 ? 'Review responses' : 'Continue'}
          <ArrowRight size={18} />
        </button>
      </div>
      {hasReachedReview && (
        <div className="question-review-return">
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void navigate(questions.length)}
          >
            Return to summary
          </button>
        </div>
      )}
    </main>
  );
}

function UploadPanel({
  slot,
  title,
  attempt,
  busy,
  upload,
  update,
  onDirtyChange,
}: {
  slot: Slot;
  title: string;
  attempt: StudentAttempt;
  busy: boolean;
  upload: (slot: Slot, file: File) => unknown;
  update: Update;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const file = attempt.uploads[slot],
    input = useRef<HTMLInputElement>(null),
    [dragging, setDragging] = useState(false);
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [link, setLink] = useState(file?.sourceUrl || '');
  const mode =
    slot === 'deliverable'
      ? undefined
      : (attempt.submissionModes?.[slot] ??
        (file ? (file.kind === 'no_ai' ? 'no_ai' : 'ai') : undefined));
  const [collapsed, setCollapsed] = useState(false);
  const [account, setAccount] = useState(file?.kind === 'no_ai' ? file.text : '');
  const chooseMode = async (next: 'ai' | 'no_ai') => {
    if (mode === next) {
      setCollapsed(!collapsed);
      return;
    }
    if (
      file &&
      !confirm('Switch submission method? Your current submission for this task will be replaced.')
    )
      return;
    const saved = await update(`/submission-mode/${slot}`, { mode: next });
    if (saved) {
      setCollapsed(false);
      setAccount('');
      onDirtyChange?.(false);
    }
  };
  useEffect(() => setConfirmed(null), [file?.id]);
  const confirmUpload = async (complete: boolean) => {
    setConfirmed(complete);
    await update(`/upload/${slot}`, { complete }, 'PATCH');
    setConfirmed(null);
  };
  const accepted =
    slot !== 'deliverable'
      ? '.txt,.md,.pdf,.docx,.html,.json'
      : attempt.pathway === 'coding'
        ? '.py'
        : '.pdf,.docx';
  const filePicker = (
    <>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept={accepted}
        aria-label={`Choose ${slot === 'deliverable' ? title.toLowerCase() : 'transcript'}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(slot, f);
          e.target.value = '';
        }}
        disabled={busy}
      />
      <button
        className={`upload-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f && !busy) upload(slot, f);
        }}
      >
        {file ? <Check size={23} /> : <UploadCloud size={27} strokeWidth={1.3} />}
        <strong>
          {file
            ? file.name
            : `Upload ${slot === 'deliverable' ? title.toLowerCase() : 'transcript'}`}
        </strong>
        <span>
          {file
            ? `${Math.ceil(file.size / 1024)} KB · Click to replace`
            : `${accepted.replaceAll('.', '').replaceAll(',', ' / ').toUpperCase()} · Up to 10 MB`}
        </span>
      </button>
    </>
  );
  return (
    <section className="upload-panel">
      <h3>{title}</h3>
      {slot === 'deliverable' ? (
        filePicker
      ) : (
        <>
          <button
            className="submission-choice"
            aria-expanded={mode === 'ai' && !collapsed}
            aria-controls={`ai-submission-${slot}`}
            disabled={busy}
            onClick={() => void chooseMode('ai')}
          >
            I used AI <ChevronRight size={17} />
          </button>
          <div id={`ai-submission-${slot}`} hidden={mode !== 'ai' || collapsed}>
            <form
              className="chat-import"
              onSubmit={(e) => {
                e.preventDefault();
                void update(`/transcript/${slot}`, { method: 'link', url: link });
              }}
            >
              <label htmlFor={`chat-link-${slot}`}>Shared chat link</label>
              <input
                id={`chat-link-${slot}`}
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Paste your shared conversation link"
                required
                maxLength={2048}
                disabled={busy}
                aria-describedby={`chat-privacy-${slot}`}
              />
              <p id={`chat-privacy-${slot}`} className="caption">
                Anyone with the shared link may be able to read the conversation.
              </p>
              <button className="button wide" disabled={busy || !link.trim()} type="submit">
                {busy ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
                {file ? 'Replace from link' : 'Import conversation'}
              </button>
            </form>
            <p className="caption">Or upload your transcript file</p>
            {filePicker}
          </div>
          <button
            className="submission-choice"
            aria-expanded={mode === 'no_ai' && !collapsed}
            aria-controls={`no-ai-submission-${slot}`}
            disabled={busy}
            onClick={() => void chooseMode('no_ai')}
          >
            I did not use AI <ChevronRight size={17} />
          </button>
          <div id={`no-ai-submission-${slot}`} hidden={mode !== 'no_ai' || collapsed}>
            <form
              className="chat-import"
              onSubmit={async (e) => {
                e.preventDefault();
                const saved = await update(`/transcript/${slot}`, {
                  method: 'no_ai',
                  text: account,
                });
                if (saved) onDirtyChange?.(false);
              }}
            >
              <label htmlFor={`study-account-${slot}`}>
                {slot === 'learning' ? 'How did you study?' : 'How did you complete the task?'}
              </label>
              <p className="caption">
                Describe the materials or tools you used, what you did and how you checked{' '}
                {slot === 'learning' ? 'your understanding' : 'your work'}.
              </p>
              <textarea
                id={`study-account-${slot}`}
                rows={7}
                maxLength={10000}
                required
                disabled={busy}
                value={account}
                onChange={(e) => {
                  setAccount(e.target.value);
                  onDirtyChange?.(e.target.value !== file?.text);
                }}
              />
              <button type="submit" className="button wide" disabled={busy || !account.trim()}>
                Save account
              </button>
            </form>
          </div>
        </>
      )}
      {file?.kind === 'no_ai' && file.text === account && (
        <p className="caption" role="status">
          Account saved.
        </p>
      )}
      {file && file.kind !== 'no_ai' && (
        <>
          {slot !== 'deliverable' && (
            <p className="caption" role="status">
              {file.parseStatus === 'needs_review'
                ? `Saved for review. ${file.parsingNote}`
                : `Conversation ready. ${file.parsingNote ? `${file.parsingNote} ` : ''}Check the preview before confirming.`}
            </p>
          )}
          {file.sourceUrl && (
            <a className="import-source" href={file.sourceUrl} target="_blank" rel="noreferrer">
              Open shared conversation <ArrowUpRight size={13} />
            </a>
          )}
          <details className="upload-preview">
            <summary>
              Preview extracted text <ChevronRight size={14} />
            </summary>
            <pre>{file.text}</pre>
            <a href={`/api/upload/${slot}`} className="text-button">
              <Download size={13} />
              {file.sourceUrl ? 'Imported transcript' : 'Original file'}
            </a>
          </details>
          <p className="caption">
            {slot === 'deliverable'
              ? attempt.pathway === 'essay'
                ? `${file.words} words before bibliography${file.words > 1000 ? ' · Exceeds the 1,000-word limit' : ''}`
                : 'Python file ready'
              : file.parseStatus === 'needs_review'
                ? 'Speaker attribution needs review; no automatic transcript score will be assigned.'
                : `${file.turns.filter((t) => t.role === 'student').length} student messages · ${file.turns.filter((t) => t.role === 'assistant').length} assistant messages`}
          </p>
          {slot !== 'deliverable' && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={confirmed ?? file.complete}
                disabled={busy}
                onChange={(e) => void confirmUpload(e.target.checked)}
              />
              <span>This is my complete conversation for this task.</span>
            </label>
          )}
        </>
      )}
    </section>
  );
}

function TaskPage({
  attempt,
  content,
  busy,
  update,
  upload,
  learning = false,
}: {
  attempt: StudentAttempt;
  content: PublicContent;
  busy: boolean;
  update: Update;
  upload: (slot: Slot, file: File) => unknown;
  learning?: boolean;
}) {
  const [tab, setTab] = useState('brief');
  const [submissionDirty, setSubmissionDirty] = useState(false);
  const source = content.briefs[learning ? 'learning' : attempt.pathway!];
  const brief = source
    .replace(/^# .+\n/, '')
    .replace(/^Suggested time:.+\n/m, '')
    .replace(
      '### Topics to study',
      'The timer is just a reference for how long we expect you to spend studying the material. You can take as much time as you need.\n\n### Topics to study',
    );
  const rubric = brief.split('## Deliverable rubric')[1]?.split('## What to submit')[0] || '';
  const detailTab = learning ? 'slides' : attempt.pathway === 'coding' ? 'problem' : 'rubric';
  const ready = learning
    ? attempt.uploads.learning?.complete
    : attempt.uploads.creation?.complete && attempt.uploads.deliverable;
  return (
    <main id="main" className="content task-page">
      <div className="task-heading">
        <div>
          <div className="eyebrow">
            {learning
              ? '03 / Learning task'
              : `04 / ${attempt.pathway === 'essay' ? 'Essay' : 'Coding'} task`}
          </div>
          <h1 tabIndex={-1}>
            {learning
              ? 'Show how you learn with AI - by studying how memory works.'
              : attempt.pathway === 'essay'
                ? 'Who shapes what we like?'
                : 'Gifts Fixing.'}
          </h1>
        </div>
        <Timer since={attempt.stageStarted[learning ? 'learning' : 'creation']} estimate={20} />
      </div>
      <div className="task-layout">
        <div className="task-main">
          <div
            className="tabs"
            role="tablist"
            aria-label="Task material"
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const nextBrief = event.key === 'Home' || (event.key !== 'End' && tab !== 'brief');
              setTab(nextBrief ? 'brief' : detailTab);
              document.getElementById(nextBrief ? 'task-brief-tab' : 'task-detail-tab')?.focus();
            }}
          >
            <button
              id="task-brief-tab"
              aria-controls="task-panel"
              tabIndex={tab === 'brief' ? 0 : -1}
              role="tab"
              aria-selected={tab === 'brief'}
              onClick={() => setTab('brief')}
            >
              <FileText size={16} />
              Brief
            </button>
            <button
              id="task-detail-tab"
              aria-controls="task-panel"
              tabIndex={tab !== 'brief' ? 0 : -1}
              role="tab"
              aria-selected={tab !== 'brief'}
              onClick={() => setTab(detailTab)}
            >
              {learning ? (
                <BookOpen size={16} />
              ) : attempt.pathway === 'coding' ? (
                <Code2 size={16} />
              ) : (
                <ShieldCheck size={16} />
              )}
              {learning
                ? 'Study slides'
                : attempt.pathway === 'coding'
                  ? 'Problem'
                  : 'Deliverable rubric'}
            </button>
            {learning && (
              <a href="/memory-attention.pdf" download className="text-button">
                <Download size={15} />
                <span>PDF</span>
              </a>
            )}
          </div>
          <div
            id="task-panel"
            className="task-tab"
            role="tabpanel"
            aria-labelledby={tab === 'brief' ? 'task-brief-tab' : 'task-detail-tab'}
          >
            {tab === 'slides' ? (
              <Suspense fallback={<p>Loading slides</p>}>
                <PdfViewer />
              </Suspense>
            ) : tab === 'problem' ? (
              <Suspense fallback={<p>Loading problem...</p>}>
                <ProblemStatement source={content.codingProblem} />
              </Suspense>
            ) : (
              <div className="prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {tab === 'rubric' ? rubric : brief}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
        <aside className="submission-area">
          <div className="eyebrow">Your submission</div>
          {!learning && (
            <UploadPanel
              slot="deliverable"
              title={attempt.pathway === 'essay' ? 'Essay' : 'Python solution'}
              {...{ attempt, busy, upload, update }}
            />
          )}
          <UploadPanel
            slot={learning ? 'learning' : 'creation'}
            title="How you worked"
            onDirtyChange={setSubmissionDirty}
            {...{ attempt, busy, upload, update }}
          />
          <button
            className="button wide"
            disabled={!ready || busy || submissionDirty}
            onClick={() => void update('/stage/submit')}
          >
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <>
                {learning ? 'Continue to creation task' : 'Submit assessment'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          {!learning && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    'Change pathway? Your current creation uploads will be cleared from this draft.',
                  )
                )
                  void update('/pathway/change');
              }}
            >
              <ArrowLeft size={15} />
              Change pathway
            </button>
          )}
        </aside>
      </div>
    </main>
  );
}
