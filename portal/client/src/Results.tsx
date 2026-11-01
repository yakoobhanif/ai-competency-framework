import { dimensionColors, profileColors } from './palette';
import { type CSSProperties } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  Layers,
  Printer,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { Report, ProfileView } from '../../shared/types';
import CapabilityPortrait from './CapabilityPortrait';
import { summaryFallback } from '../../shared/result-feedback';
import { resultStory } from '../../shared/result-story';
import './results.css';

const labels: Record<ProfileView, string> = {
  quiz: 'Quiz',
  learning: 'Quiz + learning task',
  creation: 'Quiz + creation task',
  both: 'Quiz + both tasks',
};
const dimensions = [
  {
    name: 'Understand AI',
    short: 'Understand',
    icon: Compass,
    color: dimensionColors.U,
    text: 'Know how AI works, where it is used and what its limits are.',
  },
  {
    name: 'Learn and Solve with AI',
    short: 'Learn',
    icon: BookOpen,
    color: dimensionColors.L,
    text: 'Explore ideas, work through problems and build understanding with AI.',
  },
  {
    name: 'Create with AI',
    short: 'Create',
    icon: Layers,
    color: dimensionColors.C,
    text: 'Plan, develop and refine useful work with AI.',
  },
  {
    name: 'Evaluate and Use AI Responsibly',
    short: 'Evaluate',
    icon: ShieldCheck,
    color: dimensionColors.R,
    text: 'Check AI’s output and make informed, responsible decisions.',
  },
];
const titles = [
  'What you know.',
  'How you see yourself.',
  'How you learn with AI.',
  'How you create with AI.',
  'Your capabilities, together.',
];
const introductions = [
  'Your quiz gives a starting picture of your AI knowledge and judgement.',
  'Compare your quiz results with how you described your own abilities.',
  'See what your learning task adds to your quiz results.',
  'See what your creation task adds to your quiz results, independently of the learning task.',
  'Bring both practical tasks together to reflect on your strengths and what to practise next.',
];

export default function Results({
  report,
  name,
  onBack,
  onRevise,
  onDelete,
  onRetry,
}: {
  report: Report;
  name: string;
  onBack: () => void;
  onRevise?: () => void;
  onDelete?: () => void;
  onRetry?: () => void;
}) {
  const baseline = report.views!.quiz;
  return (
    <main id="main" className="profile-results">
      <div className="content profile-inner">
        <header className="profile-heading">
          <div className="profile-welcome">
            <div className="eyebrow">
              <span className="completion-mark">
                <Check size={13} aria-hidden="true" />
              </span>
              Assessment complete
            </div>
            <h1>
              You’ve completed
              <br />
              the assessment.
            </h1>
            <p className="profile-thanks">
              Well done{name.trim() ? `, ${name.trim()}` : ''}! Thank you for taking the time to
              complete all four parts.
            </p>
            <p className="profile-research">
              This assessment is part of a research project at the National University of Singapore
              (NUS) to better understand students’ AI capabilities and help redesign homework for
              the generative AI era.
            </p>
          </div>
          <button
            className="icon-button profile-print no-print"
            title="Print results"
            aria-label="Print profile"
            onClick={() => window.print()}
          >
            <Printer size={19} />
          </button>
        </header>
        {report.mode === 'demo' && (
          <p className="profile-demo-note">
            <span>Demo results</span>
            Your quiz scores are real. Practical results and feedback are illustrative.
          </p>
        )}

        <section className="profile-dimension-guide" aria-labelledby="dimension-guide-title">
          <div className="profile-section-intro">
            <div className="eyebrow">The four dimensions</div>
            <h2 id="dimension-guide-title">Different ways to work well with AI.</h2>
            <p className="profile-dimension-narrative">
              This assessment uses four dimensions to look at different aspects of how you work with
              AI.
            </p>
          </div>
          <div className="dimension-map">
            {dimensions.map(({ name: dimensionName, short, icon: Icon, color, text }) => (
              <article
                className="dimension-guide"
                key={short}
                style={{ '--dimension-color': color } as CSSProperties}
              >
                <div className="dimension-icon">
                  <Icon size={24} strokeWidth={1.4} aria-hidden="true" />
                </div>
                <h3>{dimensionName}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="profile-reading-intro" aria-labelledby="profile-reading-title">
          <div>
            <div className="eyebrow">Your results</div>
            <h2 id="profile-reading-title">From what you know about AI to how you use it.</h2>
            <p>
              Below, explore your performance across the four dimensions, with feedback on your
              strengths and areas to develop. Start with your quiz, then see what your
              self-assessment and practical work add to the picture.
            </p>
            <p className="profile-interaction-hint">
              Hover over a graph or its labels to highlight a view. You can also tap the labels.
            </p>
          </div>
          <a
            className="profile-explore no-print"
            href="#chapter-quiz"
            aria-label="Explore your results"
          >
            <ArrowDown size={21} />
          </a>
        </section>

        <section className="profile-band-guide" aria-labelledby="band-guide-title">
          <h3 id="band-guide-title">What the labels mean</h3>
          <p>Each label describes the evidence in this assessment.</p>
          <div>
            {[
              ['Developing', 'An area where more practice would help.'],
              ['Established', 'A solid foundation to build on.'],
              ['Strong', 'A relative strength in your results.'],
            ].map(([band, description]) => (
              <div key={band}>
                <strong className="performance-band" data-band={band}>
                  {band}
                </strong>
                <p>{description}</p>
              </div>
            ))}
          </div>
          {Object.values(report.views!).some((view) =>
            view.dimensions.some((d) => d.band === 'Insufficient evidence'),
          ) && (
            <p className="profile-insufficient-note">
              Insufficient evidence means there is not enough information to assign a label.
            </p>
          )}
        </section>

        <div className="profile-story">
          {resultStory.map((chapter, index) => {
            const { view: selected, self: showSelf, key } = chapter;
            const current = report.views![selected] || baseline;
            const savedFeedback =
              report.summaries?.[key] || (key === 'quiz' ? report.feedback : undefined);
            // Demo prose uses the current template, including for already saved reports.
            const feedback =
              savedFeedback?.source === 'demo' ? summaryFallback(report, key) : savedFeedback;
            const paragraphs = feedback?.paragraphs ?? [];
            const preparing = report.commentary?.status === 'pending' && feedback?.source !== 'llm';
            const hasPractical = current.capabilities.some((c) => c.practical !== null);
            return (
              <section
                className="profile-chapter"
                id={`chapter-${key}`}
                key={key}
                aria-labelledby={`title-${key}`}
                style={{ '--profile-accent': profileColors.current } as CSSProperties}
              >
                <header className="profile-chapter-heading">
                  <span className="profile-chapter-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h2 id={`title-${key}`}>{titles[index]}</h2>
                    <p>{introductions[index]}</p>
                  </div>
                </header>
                <div className="profile-workspace">
                  <section
                    className="profile-chart"
                    aria-label={`${titles[index]} Dimension comparison`}
                  >
                    <CapabilityPortrait
                      baseline={baseline}
                      current={current}
                      showSelf={showSelf}
                      color={profileColors.current}
                      label={labels[selected]}
                    />
                    <div className="profile-dimensions" aria-label="Dimension results">
                      {current.dimensions.map((d, i) => (
                        <div
                          key={d.id}
                          style={{ '--dimension-color': dimensions[i].color } as CSSProperties}
                        >
                          <span>{dimensions[i].short}</span>
                          <strong className="performance-band" data-band={d.band}>
                            {d.band}
                          </strong>
                          {d.pending && <small>Some evidence awaiting review</small>}
                          {showSelf && d.self === null && (
                            <small>Self-assessment unavailable</small>
                          )}
                        </div>
                      ))}
                    </div>
                    {selected !== 'quiz' && !hasPractical && (
                      <p className="profile-notice">
                        {current.capabilities.some((c) => c.pending)
                          ? 'Your practical submission is awaiting review. Your quiz baseline is shown for now.'
                          : 'No eligible practical evidence is available in this view. Your quiz baseline is retained.'}
                      </p>
                    )}
                  </section>
                  <div className="profile-reflection" aria-label="Assessment reflection">
                    <div className="eyebrow">
                      {index === 1
                        ? 'A moment to reflect'
                        : index === 4
                          ? 'Strengths & next steps'
                          : 'What this suggests'}
                    </div>
                    {preparing && (
                      <p className="profile-summary-status" role="status">
                        Your AI reflection is being prepared. Your results are ready to explore.
                      </p>
                    )}
                    {!preparing && feedback?.source === 'fallback' && (
                      <p className="profile-summary-status">
                        AI commentary is unavailable. Your results are still available below.
                      </p>
                    )}
                    <div className="profile-overview" aria-live="polite">
                      {paragraphs.length ? (
                        paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)
                      ) : (
                        <p>
                          This view has no saved summary. Re-evaluate the assessment to prepare one.
                        </p>
                      )}
                    </div>
                    {index === 1 && (
                      <p className="profile-self-note">
                        The dashed outline shows your own perspective. It uses a separate scale and
                        does not change your results.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <footer className="profile-end">
          <p>This is a picture of your work in this assessment, with room to keep growing.</p>
          <div className="profile-actions no-print">
            <button className="button" onClick={onBack}>
              Return home
              <ArrowRight size={17} />
            </button>
            <details className="profile-manage">
              <summary>Manage your assessment</summary>
              <div>
                {onRetry && (
                  <button
                    className="text-button"
                    onClick={onRetry}
                    disabled={report.commentary?.status === 'pending'}
                  >
                    <RotateCcw size={15} />
                    Re-evaluate
                  </button>
                )}
                {onRevise && (
                  <button
                    className="text-button"
                    onClick={onRevise}
                    disabled={report.commentary?.status === 'pending'}
                  >
                    Correct submissions
                  </button>
                )}
                {onDelete && (
                  <button
                    className="text-button"
                    onClick={onDelete}
                    disabled={report.commentary?.status === 'pending'}
                  >
                    <Trash2 size={15} />
                    Delete my assessment
                  </button>
                )}
              </div>
            </details>
          </div>
        </footer>
      </div>
    </main>
  );
}
