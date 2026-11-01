import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DatabaseSync } from 'node:sqlite';
import { fixtureAttempt, observations } from './fixtures.js';
import { calculateReport } from '../server/scoring.js';
import { quizKey, publicContent } from '../server/content.js';
import { initializeSummaries } from '../server/summaries.js';
import type { QuizValue } from '../shared/types.js';

function profile() {
  const attempt = fixtureAttempt();
  attempt.quiz = Object.fromEntries(
    publicContent.quiz.map((q, i) => [
      q.id,
      q.options!.find((o) =>
        i % 3 === 0
          ? quizKey[q.id].points[o.id] === 0
          : quizKey[q.id].points[o.id] === quizKey[q.id].max,
      )!.id as QuizValue,
    ]),
  );
  const obs = observations();
  for (const o of obs)
    if (o.status === 'scored')
      o.score = o.capability === 'R1' ? 0.5 : o.task === 'learning' ? 0.9 : 0.75;
  attempt.report = calculateReport(attempt, obs, { verdict: 'Pass', criteria: [], checks: {} });
  initializeSummaries(attempt.report);
  return { ...attempt, name: 'Test student' };
}
async function mount(page: Page, value: () => unknown) {
  await page.addInitScript(() => sessionStorage.setItem('assessment-screen', 'flow'));
  await page.route('**/api/attempt', (route) => route.fulfill({ json: value() }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /You’ve completed/ })).toBeVisible();
}

test('all five story chapters render on scroll with scoped charts and no new requests', async ({
  page,
}) => {
  const attempt = profile();
  await mount(page, () => attempt);
  const calls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/') && !r.url().endsWith('/api/attempt')) calls.push(r.url());
  });
  await expect(page.locator('.profile-chapter')).toHaveCount(5);
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  const order = ['quiz', 'quiz-self', 'learning-self', 'creation-self', 'both-self'];
  for (const key of order) {
    const chapter = page.locator(`#chapter-${key}`);
    await chapter.scrollIntoViewIfNeeded();
    await expect(chapter.locator('.portrait-svg')).toBeVisible();
    await expect(chapter.locator('.portrait-main')).toHaveAttribute('d', /^M[^CQ]*L[^CQ]*Z$/);
    await expect(chapter.locator('.portrait-main')).toHaveAttribute('fill-opacity', '0.26');
    await expect(chapter.locator('.profile-overview')).not.toBeEmpty();
    expect(await chapter.locator('.profile-dimensions').innerText()).not.toMatch(/\d/);
    await expect(chapter.locator('.portrait-self')).toHaveCount(key.endsWith('-self') ? 1 : 0);
    await expect(chapter.locator('.portrait-baseline')).toHaveCount(key.startsWith('quiz') ? 0 : 1);
    const view = key.replace('-self', '') as 'quiz' | 'learning' | 'creation' | 'both';
    const x = Number(await chapter.locator('.portrait-anchor').nth(1).getAttribute('cx'));
    expect(x).toBeCloseTo(320 + (188 * attempt.report!.views![view].dimensions[1].score!) / 100, 4);
  }
  expect(calls).toEqual([]);
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/results-story-desktop.png', fullPage: true });
  await page.screenshot({ path: 'test-results/results-story-opening.png' });
  await page
    .locator('#chapter-both-self')
    .screenshot({ path: 'test-results/results-story-combined.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'test-results/results-story-mobile.png', fullPage: true });
  await page
    .locator('#chapter-quiz-self')
    .screenshot({ path: 'test-results/results-story-mobile-chapter.png' });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.profile-chapter')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Print profile', exact: true })).toBeHidden();
});

test('missing and pending evidence stays explicit in the scroll story', async ({ page }) => {
  const attempt = profile();
  for (const view of Object.values(attempt.report!.views!)) {
    view.dimensions[0].score = null;
    view.dimensions[0].band = 'Insufficient evidence';
    view.dimensions[0].self = null;
    view.dimensions[1].pending = true;
    for (const capability of view.capabilities) {
      capability.practical = null;
      capability.pending = true;
    }
  }
  await mount(page, () => attempt);
  const chapter = page.locator('#chapter-learning-self');
  await expect(chapter.getByText('Some evidence awaiting review')).toBeVisible();
  await expect(chapter.getByText('Self-assessment unavailable')).toBeVisible();
  await expect(chapter.locator('.profile-notice')).toContainText(
    'Your practical submission is awaiting review',
  );
  expect(await chapter.locator('.portrait-main').getAttribute('d')).not.toContain('Z');
  await expect(chapter.locator('.portrait-main')).toHaveAttribute('fill', 'none');
  await expect(chapter.locator('.portrait-anchor')).toHaveCount(3);
});

test('chart survives missing commentary fields and updates when background summaries finish', async ({
  page,
}) => {
  const attempt = profile();
  attempt.job.status = 'running';
  attempt.report!.commentary = { status: 'pending', completed: 0, total: 5 };
  delete (attempt.report!.summaries!.quiz as any).strengths;
  delete (attempt.report!.summaries!.quiz as any).nextSteps;
  let finished = false;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mount(page, () =>
    finished
      ? {
          ...attempt,
          job: { ...attempt.job, status: 'complete' },
          report: {
            ...attempt.report,
            commentary: { status: 'complete', completed: 5, total: 5 },
            summaries: {
              ...attempt.report!.summaries,
              quiz: {
                paragraphs: [
                  'Your reasoning is strongest when you check your assumptions.',
                  'You could practise checking an unfamiliar claim. Use an independent source.',
                ],
                source: 'llm',
              },
            },
          },
        }
      : attempt,
  );
  await expect(page.locator('#chapter-quiz .profile-radar')).toBeVisible();
  // Demo feedback is still a completed template; a real pending fallback displays the status.
  attempt.report!.summaries!.quiz!.source = 'fallback';
  await page.reload();
  await expect(
    page.locator('#chapter-quiz').getByText(/Your AI reflection is being prepared/),
  ).toBeVisible();
  finished = true;
  await expect(
    page.getByText('Your reasoning is strongest when you check your assumptions.'),
  ).toBeVisible({ timeout: 10000 });
  expect(errors).toEqual([]);
});

test('completed synthetic live report renders real model commentary', async ({ page }) => {
  test.skip(
    !process.env.LIVE_TEST_ATTEMPT_ID,
    'Requires a completed synthetic live integration run.',
  );
  const db = new DatabaseSync(`${process.env.LIVE_TEST_DATA_DIR || '.data'}/assessment.sqlite`, {
    readOnly: true,
  });
  const row = db
    .prepare('SELECT body FROM attempts WHERE id=?')
    .get(process.env.LIVE_TEST_ATTEMPT_ID!) as { body: string };
  const attempt = { ...JSON.parse(row.body), name: 'Synthetic integration check' };
  db.close();
  expect(attempt.mode).toBe('live');
  expect(
    Object.values(attempt.report.summaries).every((s: any) => s.source === 'llm'),
  ).toBeTruthy();
  await mount(page, () => attempt);
  await expect(page.locator('#chapter-quiz .profile-overview')).toBeVisible();
  await page.locator('#chapter-both-self').scrollIntoViewIfNeeded();
  await expect(page.locator('#chapter-both-self .profile-overview')).not.toBeEmpty();
  await page.screenshot({ path: 'test-results/results-live.png', fullPage: true });
});

test('completion, research context and dimension guide precede focused results in both modes', async ({
  page,
}) => {
  for (const mode of ['demo', 'live'] as const) {
    const attempt = profile();
    attempt.mode = mode;
    attempt.report!.mode = mode;
    if (mode === 'demo')
      attempt.report!.summaries!.quiz!.paragraphs = [
        'You could practise make an accountable final decision.',
      ];
    await mount(page, () => attempt);
    await expect(
      page.getByText(
        'Well done, Test student! Thank you for taking the time to complete all four parts.',
      ),
    ).toBeVisible();
    await expect(page.locator('.profile-research')).toContainText(
      'National University of Singapore (NUS)',
    );
    await expect(page.locator('.profile-research')).toContainText('redesign homework');
    await expect(page.locator('.dimension-guide')).toHaveCount(4);
    await expect(page.locator('.profile-dimension-narrative')).toContainText('four dimensions');
    await expect(page.locator('.profile-band-guide .performance-band')).toHaveText([
      'Developing',
      'Established',
      'Strong',
    ]);
    await expect(page.getByText('About these results', { exact: true })).toHaveCount(0);
    await expect(
      page.getByText('You could practise make an accountable final decision.', { exact: true }),
    ).toHaveCount(0);
    const bandGuideY = (await page.locator('.profile-band-guide').boundingBox())!.y;
    expect(bandGuideY).toBeLessThan((await page.locator('#chapter-quiz').boundingBox())!.y);
    const closing = page.locator('.profile-end > p');
    expect(await closing.evaluate((node) => node.getBoundingClientRect().height)).toBeLessThan(40);
    await expect(page.locator('.profile-demo-note')).toHaveCount(mode === 'demo' ? 1 : 0);
    const positions = await page
      .locator('.profile-heading, .profile-dimension-guide, .profile-reading-intro, #chapter-quiz')
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    await expect(page.getByRole('button', { name: 'Re-evaluate', exact: true })).toBeHidden();
    await page.getByText('Manage your assessment', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await page.screenshot({ path: `test-results/results-${mode}-mobile-opening.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.unroute('**/api/attempt');
  }
});

test('graph profiles highlight on hover, keyboard focus and touch selection without changing results', async ({
  page,
  browser,
}) => {
  const attempt = profile();
  await mount(page, () => attempt);
  const chapter = page.locator('#chapter-learning-self');
  await chapter.scrollIntoViewIfNeeded();
  const portrait = chapter.locator('.capability-portrait');
  const before = await chapter.locator('.portrait-main').getAttribute('d');
  const active = chapter.getByRole('button', {
    name: 'Highlight Quiz + learning task',
    exact: true,
  });
  const self = chapter.getByRole('button', { name: 'Highlight Self-assessment', exact: true });
  const quiz = chapter.getByRole('button', { name: 'Highlight Quiz', exact: true });
  await chapter.locator('.portrait-anchor').nth(1).hover();
  await expect(portrait).toHaveAttribute('data-highlight', 'main');
  await active.hover();
  await expect(portrait).toHaveAttribute('data-highlight', 'main');
  await expect(chapter.locator('.portrait-main')).toHaveCSS('stroke-width', '4px');
  await quiz.hover();
  await expect(portrait).toHaveAttribute('data-highlight', 'baseline');
  await page.mouse.move(0, 0);
  await self.focus();
  await expect(portrait).toHaveAttribute('data-highlight', 'self');
  await self.press('Enter');
  await expect(self).toHaveAttribute('aria-pressed', 'true');
  await self.evaluate((button: HTMLButtonElement) => button.blur());
  await expect(portrait).toHaveAttribute('data-highlight', 'self');
  await self.click();
  await expect(self).toHaveAttribute('aria-pressed', 'false');
  await page.mouse.move(0, 0);
  await page.keyboard.press('Tab');
  await active.focus();
  await expect(portrait).toHaveAttribute('data-highlight', 'main');
  expect(await chapter.locator('.portrait-main').getAttribute('d')).toBe(before);
  await page.screenshot({ path: 'test-results/results-graph-highlight.png' });
  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const touchPage = await touchContext.newPage();
  await mount(touchPage, () => attempt);
  const touchChapter = touchPage.locator('#chapter-learning-self');
  const touchButton = touchChapter.getByRole('button', {
    name: 'Highlight Self-assessment',
    exact: true,
  });
  await touchButton.tap();
  await expect(touchButton).toHaveAttribute('aria-pressed', 'true');
  await expect(touchChapter.locator('.capability-portrait')).toHaveAttribute(
    'data-highlight',
    'self',
  );
  await touchButton.tap();
  await expect(touchChapter.locator('.capability-portrait')).toHaveAttribute(
    'data-highlight',
    'none',
  );
  await touchContext.close();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(chapter.locator('.portrait-series').first()).toHaveCSS('transition-duration', '0s');
});

test('dimension colours agree across the results guide, graph, labels and study explanation', async ({
  page,
}) => {
  await mount(page, () => profile());
  const guideColors = await page
    .locator('.dimension-guide h3')
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).color));
  const axisColors = await page
    .locator('#chapter-both-self .portrait-axis-labels text')
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).fill));
  const labelColors = await page
    .locator('#chapter-both-self .profile-dimensions > div > span')
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).color));
  expect(axisColors).toEqual(guideColors);
  expect(labelColors).toEqual(guideColors);
  const categoryColors = await page
    .locator('.profile-band-guide .performance-band')
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).color));
  expect(categoryColors.every((color) => !guideColors.includes(color))).toBeTruthy();
  const currentStrokes = await page
    .locator('.portrait-main')
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).stroke));
  expect(new Set(currentStrokes).size).toBe(1);
  expect(categoryColors).not.toContain(currentStrokes[0]);
  await page.goto('/vision');
  const tabs = page.getByRole('tab');
  for (let i = 0; i < 4; i++) {
    await tabs.nth(i).click();
    await expect(page.locator('.vision-domain-panel h3')).toHaveCSS('color', guideColors[i]);
    await expect(tabs.nth(i).locator('svg')).toHaveCSS('color', guideColors[i]);
  }
  await page
    .locator('.vision-framework')
    .screenshot({ path: 'test-results/vision-dimension-palette.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});
