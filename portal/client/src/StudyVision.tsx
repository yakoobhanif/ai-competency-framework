import { dimensionColors } from './palette';
import { lazy, Suspense, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  ArrowDown,
  ArrowUpRight,
  BookOpen,
  Brain,
  Check,
  Compass,
  FileText,
  GraduationCap,
  Layers3,
  MessageSquare,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import './study-vision.css';
import { frameworkCapabilities } from '../../shared/framework';

const LightField = lazy(() => import('./LightField'));
const dimensions = [
  {
    name: 'Understand',
    full: 'Understand AI',
    color: dimensionColors.U,
    icon: Brain,
    text: 'Understand how AI works, where it is used and what it can and cannot do.',
    example: 'Choose a suitable AI tool and explain why its answers may need checking.',
  },
  {
    name: 'Learn',
    full: 'Learn and solve with AI',
    color: dimensionColors.L,
    icon: BookOpen,
    text: 'Use AI to explore ideas, solve problems and develop understanding.',
    example:
      'Work through a problem, then use AI feedback to identify where the reasoning needs work.',
  },
  {
    name: 'Create',
    full: 'Create with AI',
    color: dimensionColors.C,
    icon: Sparkles,
    text: 'Plan, develop and refine useful work with AI.',
    example: 'Set the purpose of an essay and provide relevant sources to generate a draft.',
  },
  {
    name: 'Evaluate',
    full: 'Evaluate and use AI responsibly',
    color: dimensionColors.R,
    icon: ShieldCheck,
    text: 'Check AI’s output and make informed, responsible decisions.',
    example:
      'Verify a claim, protect private information and decide whether an answer is ready to use.',
  },
];
const activities = [
  {
    icon: Compass,
    title: 'Self-assessment',
    text: 'Students rate what they feel able to do with AI across 25 questions.',
  },
  {
    icon: ScanLine,
    title: 'Capability quiz',
    text: 'Students answer 25 short questions about AI knowledge and judgement.',
  },
  {
    icon: BookOpen,
    title: 'Learning task',
    text: 'Students study a topic using the provided slides and their usual AI tools.',
  },
  {
    icon: FileText,
    title: 'Creation task',
    text: 'Students choose between writing an essay and solving a coding problem with AI.',
  },
];

export default function StudyVision({
  paused,
  onStart,
  hasAttempt,
}: {
  paused: boolean;
  onStart: () => void;
  hasAttempt: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const active = dimensions[selected];
  return (
    <main id="main" className="study-vision">
      <section className="vision-wrap vision-hero">
        <div className="vision-hero-copy">
          <a className="vision-back" href="/">
            Back to the assessment <ArrowUpRight size={16} />
          </a>
          <div className="eyebrow">About the study</div>
          <h1 tabIndex={-1}>
            Understanding how
            <br />
            students use AI.
          </h1>
          <p>
            A research project at the National University of Singapore to understand students’ AI
            capabilities and help rethink homework for the generative AI era.
          </p>
          <a className="vision-scroll" href="#vision-purpose">
            Explore the study <ArrowDown size={17} />
          </a>
        </div>
        <div className="vision-hero-art" aria-hidden="true">
          <Suspense fallback={<div className="light-field" />}>
            <LightField paused={paused} framed />
          </Suspense>
        </div>
      </section>

      <section id="vision-purpose" className="vision-wrap vision-section">
        <div className="vision-section-heading">
          <span className="eyebrow">Why we’re doing this</span>
          <h2>Learning is changing. Homework can change too.</h2>
          <p>
            Generative AI is becoming part of university work. We want to understand how students
            use it and what that means for the way we teach and assess learning.
          </p>
        </div>
        <div className="vision-purposes">
          <article>
            <GraduationCap size={26} aria-hidden="true" />
            <h3>Understand students’ capabilities.</h3>
            <p>
              Learn where students feel confident, what they know and how they use AI in practice.
            </p>
          </article>
          <article>
            <Layers3 size={26} aria-hidden="true" />
            <h3>Rethink how homework is assessed.</h3>
            <p>
              Explore what a student’s final work and conversation with AI can tell us about their
              understanding and judgement.
            </p>
          </article>
        </div>
      </section>

      <section className="vision-framework vision-section">
        <div className="vision-wrap">
          <div className="vision-section-heading">
            <span className="eyebrow">What we look at</span>
            <h2>Four dimensions of AI capability.</h2>
            <p>
              We group {frameworkCapabilities.length} capabilities into four dimensions. These help
              us look at different aspects of how students understand and work with AI.
            </p>
          </div>
          <p className="vision-tab-hint">Select a dimension to explore it.</p>
          <div className="vision-domain-tabs" role="tablist" aria-label="Framework dimensions">
            {dimensions.map((d, i) => (
              <button
                key={d.name}
                id={`domain-tab-${i}`}
                role="tab"
                aria-selected={selected === i}
                aria-controls="vision-domain-panel"
                tabIndex={selected === i ? 0 : -1}
                style={{ '--domain-color': d.color } as CSSProperties}
                onClick={() => setSelected(i)}
                onKeyDown={(e) => {
                  if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
                    e.preventDefault();
                    const next =
                      e.key === 'Home'
                        ? 0
                        : e.key === 'End'
                          ? 3
                          : (i + (e.key === 'ArrowRight' ? 1 : 3)) % 4;
                    setSelected(next);
                    document.getElementById(`domain-tab-${next}`)?.focus();
                  }
                }}
              >
                <d.icon size={24} aria-hidden="true" />
                <span>{d.name}</span>
              </button>
            ))}
          </div>
          <div
            id="vision-domain-panel"
            className="vision-domain-panel"
            role="tabpanel"
            aria-labelledby={`domain-tab-${selected}`}
            style={{ '--domain-color': active.color } as CSSProperties}
          >
            <div>
              <h3>{active.full}</h3>
              <p className="vision-domain-description">{active.text}</p>
            </div>
            <div className="vision-domain-example">
              <span className="vision-kicker">For example</span>
              <p>{active.example}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="vision-wrap vision-section">
        <div className="vision-section-heading">
          <span className="eyebrow">Taking part</span>
          <h2>Four parts, from reflection to practice.</h2>
          <p>Students start with two questionnaires, followed by two practical tasks.</p>
        </div>
        <ol className="vision-activities">
          {activities.map((a, i) => (
            <li key={a.title}>
              <div className="vision-activity-top">
                <span className="vision-step-index" aria-label={`Part ${i + 1}`}>
                  0{i + 1}
                </span>
                <a.icon size={24} className="vision-step-icon" aria-hidden="true" />
              </div>
              <h3>{a.title}</h3>
              <p>{a.text}</p>
            </li>
          ))}
        </ol>
        <div className="vision-participation-note">
          <p>
            Students complete the self-assessment and quiz independently, without AI or other tools.
          </p>
          <p>
            For each practical task, students share their conversation with AI. The creation task
            also requires the final work. Students who work without AI describe their approach
            instead.
          </p>
        </div>
        <div className="vision-takeaway">
          <Compass size={26} aria-hidden="true" />
          <div>
            <h3>Feedback to reflect on.</h3>
            <p>
              At the end, students see their results across the four dimensions, with feedback on
              strengths and areas to practise. They can also compare their self-assessment with
              their actual performance.
            </p>
          </div>
        </div>
      </section>

      <section className="vision-future vision-section">
        <div className="vision-wrap">
          <div className="vision-section-heading">
            <span className="eyebrow">Where this could lead</span>
            <h2>Homework that considers how students got there.</h2>
            <p>
              We’re exploring assignments that consider both the finished work and the decisions a
              student makes while using AI.
            </p>
          </div>
          <div
            className="vision-assignment"
            aria-label="Final work and an AI conversation together provide evidence of student capability"
          >
            <div className="vision-evidence-streams">
              <article>
                <FileText size={26} aria-hidden="true" />
                <h3>The final work</h3>
                <p>
                  What the student produced, how well it answers the task and the ideas it brings
                  together.
                </p>
              </article>
              <article>
                <MessageSquare size={26} aria-hidden="true" />
                <h3>The conversation with AI</h3>
                <p>
                  How the student framed the task, questioned answers, checked claims and improved
                  the work.
                </p>
              </article>
            </div>
            <div className="vision-assignment-result">
              <Check size={23} aria-hidden="true" />
              <p>A fuller picture of the work and the choices behind it.</p>
            </div>
          </div>
          <p className="vision-caption">
            This study is a first step in testing how consistently and usefully we can assess these
            capabilities.
          </p>
        </div>
      </section>

      <section className="vision-wrap vision-section vision-invitation">
        <div>
          <h2>Take part in the study.</h2>
          <p>
            Taking part will help us improve the assessment and explore new approaches to homework.
          </p>
        </div>
        <button className="button white" onClick={onStart}>
          {hasAttempt ? 'Resume assessment' : 'Start assessment'}
          <ArrowRight size={20} />
        </button>
      </section>
    </main>
  );
}
