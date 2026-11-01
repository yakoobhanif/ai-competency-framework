import { useState } from 'react';
import { ArrowLeft, Check, ScanLine, RefreshCw } from 'lucide-react';
import type { StudentAttempt } from '../../shared/types';
import { api } from './api';

type Row = {
  id: string;
  name: string;
  mode: string;
  pending: number;
  updatedAt: string;
  stage: string;
};
export default function Review() {
  const [token, setToken] = useState(''),
    [rows, setRows] = useState<Row[] | null>(null),
    [attempt, setAttempt] = useState<StudentAttempt | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const call = async <T,>(url: string, body?: unknown) => {
    setError('');
    setBusy(true);
    try {
      return await api<T>(url, {
        headers: { 'x-reviewer-token': token },
        ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
      });
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const load = async () => {
    const r = await call<Row[]>('/review');
    if (r) setRows(r);
  };
  const adjudicate = async (form: HTMLFormElement, capability: string, task?: string) => {
    const data = new FormData(form),
      score = data.get('score');
    const body = {
      capability,
      task,
      reason: data.get('reason'),
      ...(capability === 'C5'
        ? { verdict: data.get('verdict') }
        : { score: score === 'absent' ? null : Number(score) }),
    };
    const a = await call<StudentAttempt>(`/review/${attempt!.id}`, body);
    if (a) setAttempt(a);
  };
  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="/">
          <ScanLine />
          AI COMPETENCY
        </a>
        <span>Reviewer workspace</span>
      </header>
      <main className="content review-page">
        <div className="eyebrow">Local research pilot</div>
        <h1>Evidence, then judgement.</h1>
        {error && (
          <p role="alert" className="notice danger">
            {error}
          </p>
        )}
        {!rows ? (
          <form
            className="review-login"
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
          >
            <label htmlFor="review-token">Reviewer token</label>
            <input
              id="review-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              autoComplete="off"
            />
            <p className="caption">
              Stored locally in .data/reviewer-token, or configured through ADMIN_TOKEN.
            </p>
            <button className="button" disabled={busy}>
              Open workspace
            </button>
          </form>
        ) : !attempt ? (
          <>
            <div className="section-heading">
              <h2>Assessment attempts</h2>
              <button
                className="icon-button bordered"
                aria-label="Refresh attempts"
                title="Refresh attempts"
                onClick={() => void load()}
              >
                <RefreshCw size={18} />
              </button>
            </div>
            {rows.length === 0 && <p>No submitted attempts yet.</p>}
            <div className="review-list">
              {rows.map((r) => (
                <button
                  key={r.id}
                  onClick={() =>
                    void call<StudentAttempt>(`/review/${r.id}`).then((a) => a && setAttempt(a))
                  }
                >
                  <span>
                    <strong>{r.name}</strong>
                    <small>
                      {r.id.slice(0, 8)} · {r.mode}
                    </small>
                  </span>
                  <span>{r.pending} pending</span>
                  <span>{new Date(r.updatedAt).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              className="text-button"
              onClick={() => {
                setAttempt(null);
                void load();
              }}
            >
              <ArrowLeft size={16} />
              All attempts
            </button>
            <h2>
              {attempt.name} <span className="muted">/ {attempt.pathway}</span>
            </h2>
            <p className="caption">
              {attempt.mode === 'demo'
                ? 'Demo attempt: practical values are illustrative.'
                : 'Review the complete conversation. The probability describes evidence in this task, not overall ability.'}
            </p>
            {!attempt.report ? (
              <p>{attempt.job.error || 'The report is not available.'}</p>
            ) : (
              <>
                <section className="review-deliverable">
                  <h3>Deliverable: {attempt.report.deliverable.verdict}</h3>
                  <details>
                    <summary>View submission and objective checks</summary>
                    <pre>{attempt.uploads.deliverable?.text}</pre>
                    <pre>{JSON.stringify(attempt.report.deliverable.checks, null, 2)}</pre>
                  </details>
                  <form
                    className="review-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void adjudicate(e.currentTarget, 'C5');
                    }}
                  >
                    <label>
                      Verdict
                      <select name="verdict" defaultValue={attempt.report.deliverable.verdict}>
                        <option>Pass</option>
                        <option>Fail</option>
                        <option>Pending</option>
                      </select>
                    </label>
                    <label>
                      Reason and evidence
                      <input
                        name="reason"
                        minLength={10}
                        required
                        placeholder="Record the basis for your judgement"
                      />
                    </label>
                    <button className="button" disabled={busy}>
                      <Check size={16} />
                      Save
                    </button>
                  </form>
                </section>
                {attempt.report.capabilities
                  .filter((c) => c.observations.length)
                  .map((c) => (
                    <section className="review-capability" key={c.id}>
                      <h3>
                        {c.id} · {c.name}
                      </h3>
                      {c.observations.map((o) => (
                        <div className="review-observation" key={o.task}>
                          <p>
                            <strong>{o.task}</strong> · {o.status} · {o.score ?? 'Unscored'}{' '}
                          </p>
                          <p className="caption">{o.reason}</p>
                          <details>
                            <summary>Complete transcript and original decisions</summary>
                            <pre>{attempt.uploads[o.task]?.text}</pre>
                            <pre>{JSON.stringify(o.raw, null, 2)}</pre>
                          </details>
                          <form
                            className="review-form"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void adjudicate(e.currentTarget, c.id, o.task);
                            }}
                          >
                            <label>
                              Evidence probability (0–1)
                              <select name="score" defaultValue="" required>
                                <option value="" disabled>
                                  Select
                                </option>
                                {[0, 0.5, 0.7, 0.8, 0.9, 1].map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                                <option value="absent">Not observed</option>
                              </select>
                            </label>
                            <label>
                              Reason and evidence
                              <input
                                name="reason"
                                minLength={10}
                                required
                                placeholder="Use turn references and justify the rating"
                              />
                            </label>
                            <button className="button" disabled={busy}>
                              <Check size={16} />
                              Save
                            </button>
                          </form>
                        </div>
                      ))}
                    </section>
                  ))}
                <details className="audit">
                  <summary>Audit history ({attempt.report.audit.length})</summary>
                  <pre>{JSON.stringify(attempt.report.audit, null, 2)}</pre>
                </details>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
