import { frameworkCapabilities } from './framework.js';
import { resultStory } from './result-story.js';
import type { Feedback, Report, SummaryKey } from './types.js';

export function summaryFallback(report: Report, key: SummaryKey): Feedback {
  const chapter = resultStory.find((c) => c.key === key)!;
  const view = report.views![chapter.view];
  const ranked = view.capabilities
    .filter((c) => c.score !== null)
    .sort((a, b) => b.score! - a.score!);
  const name = (id?: string) => frameworkCapabilities.find((c) => c.id === id)?.name;
  const first =
    key === 'quiz-self'
      ? 'Your self-assessment reflects how you see your ability across your experiences. Compare it with your quiz responses and consider where you would like more practice.'
      : chapter.view === 'quiz'
        ? 'Your quiz responses give a starting picture of your AI knowledge and judgement. They describe how you answered these scenarios.'
        : report.mode === 'demo'
          ? 'You can explore how practical evidence contributes to your profile in this view. These practical results are illustrative and do not evaluate your submitted work.'
          : 'Your practical work can add to your quiz baseline where it demonstrates a capability. Missing evidence does not establish a lack of ability.';
  const second = ranked.length
    ? report.mode === 'demo' && chapter.view !== 'quiz'
      ? `This example highlights “${name(ranked[0]?.id)}” as a relative strength. For your next task, practise the skills involved in “${name(ranked.at(-1)?.id)}” and check your decisions independently.`
      : `Your available results suggest that “${name(ranked[0]?.id)}” is a relative strength. For your next task, practise the skills involved in “${name(ranked.at(-1)?.id)}” and check your decisions independently.`
    : 'You do not yet have enough quiz evidence to form a complete profile. Your practical evidence remains available for review.';
  return {
    source: report.mode === 'demo' ? 'demo' : 'fallback',
    paragraphs: chapter.paragraphs === 1 ? [first] : [first, second],
  };
}
