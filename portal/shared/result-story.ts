import type { ProfileView, SummaryKey } from './types';

// Reading order is shared by rendering and commentary generation.
export const resultStory: {
  key: SummaryKey;
  view: ProfileView;
  self: boolean;
  focus: string;
  paragraphs: number;
}[] = [
  {
    key: 'quiz',
    view: 'quiz',
    self: false,
    paragraphs: 2,
    focus: 'Explain relative strengths and a useful area to practise based on the quiz.',
  },
  {
    key: 'quiz-self',
    view: 'quiz',
    self: true,
    paragraphs: 1,
    focus: 'Compare self-perception with quiz evidence without repeating the previous feedback.',
  },
  {
    key: 'learning-self',
    view: 'learning',
    self: true,
    paragraphs: 2,
    focus: 'Explain what the learning task adds and suggest a useful next step.',
  },
  {
    key: 'creation-self',
    view: 'creation',
    self: true,
    paragraphs: 2,
    focus: 'Explain what the creation task and deliverable add, independently of learning.',
  },
  {
    key: 'both-self',
    view: 'both',
    self: true,
    paragraphs: 2,
    focus:
      'Bring both tasks together, recognizing complementary evidence without counting the same capability twice.',
  },
];
