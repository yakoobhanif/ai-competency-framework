import { test, expect, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { runExportDir } from '../server/run-exports.js';
import { quizKey } from '../server/content.js';
import { transcript, solution, essayDocx } from './fixtures.js';

async function seedToTasks(request: APIRequestContext, name: string) {
  expect((await request.post('/api/attempt', { data: { name, consent: true } })).status()).toBe(
    201,
  );
  const content = await (await request.get('/api/content')).json();
  for (const q of content.self)
    expect(
      (
        await request.patch('/api/answers', {
          data: { stage: 'self', id: q.id, value: 3, cursor: 0 },
        })
      ).ok(),
    ).toBeTruthy();
  expect((await request.post('/api/stage/submit')).ok()).toBeTruthy();
  for (const q of content.quiz)
    expect(
      (
        await request.patch('/api/answers', {
          data: { stage: 'quiz', id: q.id, value: 'B', cursor: 0 },
        })
      ).ok(),
    ).toBeTruthy();
  expect((await request.post('/api/stage/submit')).ok()).toBeTruthy();
  expect((await request.post('/api/learning/start')).ok()).toBeTruthy();
}
async function upload(request: APIRequestContext, slot: string, name: string, data: Buffer) {
  const r = await request.post(`/api/upload/${slot}`, {
    multipart: { file: { name, mimeType: 'application/octet-stream', buffer: data } },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  if (slot !== 'deliverable')
    expect(
      (await request.patch(`/api/upload/${slot}`, { data: { complete: true } })).ok(),
    ).toBeTruthy();
}

test('self-assessment introduction waits for explicit start and preserves the timer on reload', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start fresh', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start assessment', exact: true }).click();
  await expect(page.getByText('Show how you create with AI.', { exact: true })).toBeVisible();
  await expect(page.getByText('Your name is not included in grading requests.')).toHaveCount(0);
  const config = await (await page.request.get('/api/config')).json();
  if (config.mode === 'demo') {
    await expect(page.locator('.footer')).toContainText('Demo environment');
    await expect(page.locator('.footer')).not.toContainText('Illustrative practical scoring');
    await expect(page.locator('.privacy')).toContainText(
      'Quiz scores are real, but practical results are illustrative.',
    );
  }
  await page.getByLabel('What should we call you?').fill('Introduction test');
  await expect(
    page.locator('.footer').getByRole('button', { name: 'Start fresh', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.privacy')).not.toContainText('Records are deleted');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Before you begin.' })).toBeVisible();
  await expect(
    page.locator('.footer-environment').getByRole('button', { name: 'Start fresh', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('25 questions', { exact: true })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
  expect((await (await page.request.get('/api/attempt')).json()).stageStarted.self).toBeUndefined();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Before you begin.' })).toBeVisible();
  await page.screenshot({
    path: `test-results/self-introduction-${config.mode}.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.locator('.footer-environment').scrollIntoViewIfNeeded();
  await expect(page.locator('.footer-environment')).toBeInViewport();
  await page.screenshot({
    path: `test-results/self-introduction-mobile-${config.mode}.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: "Let's begin", exact: true }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  const started = (await (await page.request.get('/api/attempt')).json()).stageStarted.self;
  expect(started).toBeTruthy();
  expect((await (await page.request.post('/api/self/start')).json()).stageStarted.self).toBe(
    started,
  );
  await page.reload();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Before you begin.' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start fresh', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 650 });
  await page.reload();
  await expect(page.getByRole('progressbar')).toBeVisible();
  const reset = page.locator('.footer').getByRole('button', { name: 'Start fresh', exact: true });
  await expect(reset).toHaveCSS('position', 'static');
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 1600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  await reset.scrollIntoViewIfNeeded();
  await expect(reset).toBeInViewport();
  await page.getByRole('button', { name: 'AI Competency home' }).click();
  await expect(
    page.locator('.entrance-footer').getByRole('button', { name: 'Start fresh', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Explore the study' }).click();
  await expect(
    page.locator('.footer').getByRole('button', { name: 'Start fresh', exact: true }),
  ).toBeVisible();
  await page.request.delete('/api/attempt');
});

test('quiz check-in waits for Start quiz and survives reloads without resetting the timer', async ({
  page,
}) => {
  await page.goto('/');
  await page.request.post('/api/attempt', {
    data: { name: 'Quiz introduction test', consent: true },
  });
  const content = await (await page.request.get('/api/content')).json();
  for (const q of content.self)
    await page.request.patch('/api/answers', {
      data: { stage: 'self', id: q.id, value: 3, cursor: 0 },
    });
  await page.request.post('/api/stage/submit');
  await page.reload();
  await page.getByRole('button', { name: 'Resume assessment' }).click();
  await expect(page.getByRole('heading', { name: 'Ready for the next task?' })).toBeVisible();
  await expect(page.getByText('25 questions', { exact: true })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
  expect((await (await page.request.get('/api/attempt')).json()).stageStarted.quiz).toBeUndefined();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ready for the next task?' })).toBeVisible();
  await page.screenshot({ path: 'test-results/quiz-introduction-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'test-results/quiz-introduction-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
  await expect(page.getByRole('progressbar')).toBeVisible();
  const started = (await (await page.request.get('/api/attempt')).json()).stageStarted.quiz;
  expect(started).toBeTruthy();
  expect((await (await page.request.post('/api/quiz/start')).json()).stageStarted.quiz).toBe(
    started,
  );
  await page.reload();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ready for the next task?' })).toHaveCount(0);
  await page.request.delete('/api/attempt');
});

test('quiz Not sure persists and all 100 static summaries appear on review', async ({ page }) => {
  await page.goto('/');
  expect(
    (
      await page.request.post('/api/attempt', {
        data: { name: 'Quiz review labels test', consent: true },
      })
    ).status(),
  ).toBe(201);
  const content = await (await page.request.get('/api/content')).json();
  const order = (await (await page.request.get('/api/attempt')).json()).quizOrder;
  expect([...order].sort()).toEqual(content.quiz.map((q: any) => q.id).sort());
  const presented = order.map((id: string) => content.quiz.find((q: any) => q.id === id));
  for (const q of content.self) {
    expect(
      (
        await page.request.patch('/api/answers', {
          data: { stage: 'self', id: q.id, value: 3, cursor: 0 },
        })
      ).ok(),
    ).toBeTruthy();
  }
  expect((await page.request.post('/api/stage/submit')).ok()).toBeTruthy();
  await page.reload();
  await page.getByRole('button', { name: 'Resume assessment' }).click();
  await expect(
    page.getByText(`If you're unsure, select "Not sure" rather than guessing.`, { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
  const unsure = page.getByRole('button', { name: 'Not sure', exact: true });
  await expect(page.getByRole('button', { name: 'Skip', exact: true })).toHaveCount(0);
  await expect(unsure.locator('svg')).toHaveCount(0);
  await unsure.click();
  await expect(unsure).toHaveAttribute('aria-pressed', 'true');
  expect((await (await page.request.get('/api/attempt')).json()).quiz[order[0]]).toBe('not_sure');
  await page.reload();
  await expect(unsure).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('input[type=radio]:checked')).toHaveCount(0);
  await page.getByRole('radio').nth(1).check();
  await expect(unsure).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('radio').nth(1)).toBeChecked();
  for (const letter of ['A', 'B', 'C', 'D']) {
    for (const q of content.quiz) {
      expect(
        (
          await page.request.patch('/api/answers', {
            data: { stage: 'quiz', id: q.id, value: letter, cursor: content.quiz.length },
          })
        ).ok(),
      ).toBeTruthy();
    }
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ready to move on?' })).toBeVisible();
    expect((await (await page.request.get('/api/attempt')).json()).quizOrder).toEqual(order);
    await expect(page.locator('.quiz-answer-review > button > span:nth-child(2)')).toHaveText(
      presented.map((q: any) => q.title),
    );
    await expect(page.locator('.quiz-answer-review strong')).toHaveText(
      presented.map((q: any) => q.options.find((o: any) => o.id === letter).summary),
    );
  }
  await page.locator('.quiz-answer-review > button').first().click();
  await expect(page.getByRole('radio').nth(3)).toBeChecked();
  await unsure.click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  expect((await (await page.request.get('/api/attempt')).json()).quiz[order[0]]).toBe('not_sure');
  expect(
    (
      await page.request.patch('/api/answers', {
        data: { stage: 'quiz', id: order[1], value: 'not_sure', cursor: content.quiz.length },
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  await expect(page.locator('.quiz-answer-review strong').nth(0)).toHaveText('Not sure');
  await expect(page.locator('.quiz-answer-review strong').nth(1)).toHaveText('Not sure');
  await page.screenshot({ path: 'test-results/quiz-review-summaries-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'test-results/quiz-review-summaries-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Submit quiz', exact: true }).click();
  expect((await (await page.request.get('/api/attempt')).json()).stage).toBe('learning');
  await page.request.delete('/api/attempt');
});

test('desktop entrance, animated pixels, study vision and no overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start assessment', exact: true })).toBeVisible();
  await expect(page.getByText('AI COMPETENCY FRAMEWORK', { exact: true })).toBeVisible();
  await expect(page.getByText('Your own AI tool', { exact: false })).toHaveCount(0);
  await expect(page.locator('a[href*="teamlab.art"]')).toHaveCount(0);
  await expect(page.locator('.light-field canvas')).toBeVisible();
  const capture = () =>
    page.locator('.light-field canvas').evaluate((node: HTMLCanvasElement) => {
      const c = document.createElement('canvas');
      c.width = 120;
      c.height = 70;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(node, 0, 0, 120, 70);
      const pixels = ctx.getImageData(0, 0, 120, 70).data;
      let lit = 0,
        hash = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 40) lit++;
        hash = (hash + pixels[i] * (i + 1) + pixels[i + 1]) % 1000000007;
      }
      return { lit, hash };
    });
  await expect.poll(async () => (await capture()).lit).toBeGreaterThan(100);
  const before = await capture();
  await page.waitForTimeout(700);
  const after = await capture();
  expect(after.hash).not.toBe(before.hash);
  await page.getByRole('button', { name: 'Pause installation' }).click();
  await page.waitForTimeout(150);
  const paused = await capture();
  await page.waitForTimeout(300);
  expect((await capture()).hash).toBe(paused.hash);
  await page.screenshot({ path: 'test-results/landing-desktop.png', fullPage: true });
  const image = await page
    .locator('.light-field canvas')
    .evaluate((c: HTMLCanvasElement) => c.toDataURL('image/png').split(',')[1]);
  fs.writeFileSync('client/public/light-field.png', Buffer.from(image, 'base64'));
  await expect(page.getByText('Explore a sample profile')).toHaveCount(0);
  await page.getByRole('link', { name: 'Explore the study' }).click();
  await expect(page).toHaveURL(/\/vision$/);
  await expect(
    page.getByRole('heading', { name: 'Understanding how students use AI.' }),
  ).toBeVisible();
  await expect(page.getByRole('tabpanel')).toContainText('Understand AI');
  await page.getByRole('tab', { name: 'Understand', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Learn', exact: true })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('Learn and solve with AI');
  await page.getByRole('tab', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Create with AI');
  await page.getByRole('tab', { name: 'Evaluate', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Evaluate and use AI responsibly');
  await page.screenshot({ path: 'test-results/vision-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'test-results/vision-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Understanding how students use AI.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start assessment', exact: true }).click();
  await expect(page.getByLabel('What should we call you?')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test('student completes questionnaires, reloads, sees slides and submits essay', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start assessment', exact: true }).click();
  await page.getByLabel('What should we call you?').fill('Integration student');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Before you begin.' })).toBeVisible();
  const startingOrder = (await (await page.request.get('/api/attempt')).json()).quizOrder;
  expect(startingOrder).toHaveLength(25);
  expect(new Set(startingOrder).size).toBe(25);
  await page.getByRole('button', { name: "Let's begin" }).click();
  await expect(page.getByRole('button', { name: 'Return to summary', exact: true })).toHaveCount(0);
  const selfItems = (await (await page.request.get('/api/content')).json()).self;
  for (let i = 0; i < selfItems.length; i++) {
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(i));
    await expect(page.locator('.option-copy small')).toHaveText(selfItems[i].selfDescriptions);
    if (i === 0)
      await page.screenshot({ path: 'test-results/self-anchors-desktop.png', fullPage: true });
    if (i === 18) {
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
      await page.screenshot({ path: 'test-results/self-anchors-mobile.png', fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.getByRole('radio').nth(2).check();
    await expect(
      page.getByRole('button', {
        name: i === selfItems.length - 1 ? 'Review responses' : 'Continue',
        exact: true,
      }),
    ).toBeEnabled();
    if (i === 3) {
      await page.reload();
      await expect(page.getByRole('radio').nth(2)).toBeChecked();
    }
    await page
      .getByRole('button', {
        name: i === selfItems.length - 1 ? 'Review responses' : 'Continue',
        exact: true,
      })
      .click();
  }
  await page.locator('.answer-review > button').first().click();
  const returnToSummary = page.getByRole('button', { name: 'Return to summary', exact: true });
  await expect(returnToSummary).toBeVisible();
  await page.getByRole('radio').nth(4).check();
  await expect(returnToSummary).toBeEnabled();
  await page.reload();
  await expect(returnToSummary).toBeVisible();
  await expect(page.getByRole('radio').nth(4)).toBeChecked();
  const selfReview = await (await page.request.get('/api/attempt')).json();
  expect(selfReview.reviewReached.self).toBe(true);
  expect(selfReview.reviewReached.quiz).toBeUndefined();
  await page.screenshot({
    path: 'test-results/self-return-to-summary-desktop.png',
    fullPage: true,
  });
  await returnToSummary.click();
  await expect(page.getByRole('heading', { name: 'Ready to move on?' })).toBeVisible();
  await expect(page.locator('.answer-review strong').first()).toHaveText('Very well');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ready to move on?' })).toBeVisible();
  await page.getByRole('button', { name: 'Submit self-assessment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ready for the next task?' })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
  await expect(returnToSummary).toHaveCount(0);
  const quizBank = (await (await page.request.get('/api/content')).json()).quiz;
  const quizOrder = (await (await page.request.get('/api/attempt')).json()).quizOrder;
  expect(quizOrder).toEqual(startingOrder);
  const expectedAnswers: Record<string, string> = {};
  const quizItems = quizOrder.map((id: string) => quizBank.find((q: any) => q.id === id));
  const quizLength = quizItems.length;
  expect(quizLength).toBe(25);
  for (let i = 0; i < quizLength; i++) {
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(i));
    await expect(page.locator('.question-title')).toHaveText(quizItems[i].prompt);
    await expect(page.locator('.option-copy strong')).toHaveText(
      quizItems[i].options.map((o: { text: string }) => o.text),
    );
    if (i === 11) {
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
      await page.screenshot({ path: 'test-results/approved-quiz-mobile.png', fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    if (i === 18)
      await page.screenshot({ path: 'test-results/approved-quiz-desktop.png', fullPage: true });
    await page
      .getByRole('radio')
      .nth(i % 4)
      .check();
    expectedAnswers[quizItems[i].id] = ['A', 'B', 'C', 'D'][i % 4];
    if (i === 8) {
      await page.reload();
      await expect(page.locator('.question-title')).toHaveText(quizItems[i].prompt);
      await expect(page.getByRole('radio').nth(i % 4)).toBeChecked();
      await page.getByRole('button', { name: 'Previous question', exact: true }).click();
      await expect(page.locator('.question-title')).toHaveText(quizItems[i - 1].prompt);
      await expect(page.getByRole('radio').nth((i - 1) % 4)).toBeChecked();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(page.locator('.question-title')).toHaveText(quizItems[i].prompt);
    }
    await page
      .getByRole('button', {
        name: i === quizLength - 1 ? 'Review responses' : 'Continue',
        exact: true,
      })
      .click();
  }
  expect((await (await page.request.get('/api/attempt')).json()).quiz).toEqual(expectedAnswers);
  await expect(page.locator('.quiz-answer-review > button > span:nth-child(2)')).toHaveText(
    quizItems.map((q: any) => q.title),
  );
  await expect(page.locator('.quiz-answer-review strong')).toHaveText(
    quizItems.map((q: any) => q.options.find((o: any) => o.id === expectedAnswers[q.id]).summary),
  );
  await page.locator('.quiz-answer-review > button').first().click();
  await expect(returnToSummary).toBeVisible();
  await page.getByRole('radio').nth(1).check();
  await expect(returnToSummary).toBeEnabled();
  await page.reload();
  await expect(returnToSummary).toBeVisible();
  await expect(page.getByRole('radio').nth(1)).toBeChecked();
  const quizReview = await (await page.request.get('/api/attempt')).json();
  expectedAnswers[quizOrder[0]] = 'B';
  expect(quizReview.quiz).toEqual(expectedAnswers);
  expect(quizReview.quizOrder).toEqual(startingOrder);
  expect(quizReview.reviewReached).toEqual({ self: true, quiz: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await returnToSummary.scrollIntoViewIfNeeded();
  await expect(returnToSummary).toBeInViewport();
  await page.screenshot({ path: 'test-results/quiz-return-to-summary-mobile.png', fullPage: true });
  await returnToSummary.click();
  await expect(page.getByRole('heading', { name: 'Ready to move on?' })).toBeVisible();
  await expect(page.locator('.quiz-answer-review strong').first()).toHaveText(
    quizItems[0].options[1].summary,
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ready to move on?' })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Submit quiz', exact: true }).click();
  await expect(page.getByRole('heading', { name: "Now, let's work with AI." })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
  expect(
    (await (await page.request.get('/api/attempt')).json()).stageStarted.learning,
  ).toBeUndefined();
  await page.reload();
  await expect(page.getByRole('heading', { name: "Now, let's work with AI." })).toBeVisible();
  await page.screenshot({
    path: 'test-results/practical-introduction-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'test-results/practical-introduction-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Continue to learning task', exact: true }).click();
  const learningStarted = (await (await page.request.get('/api/attempt')).json()).stageStarted
    .learning;
  expect(learningStarted).toBeTruthy();
  await page.reload();
  expect((await (await page.request.get('/api/attempt')).json()).stageStarted.learning).toBe(
    learningStarted,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(
    page.getByRole('heading', {
      name: 'Show how you learn with AI - by studying how memory works.',
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'I used AI', exact: true }).click();
  await page.getByRole('tab', { name: 'Study slides' }).click();
  await expect(page.locator('.pdf-canvas canvas')).toBeVisible();
  await expect
    .poll(() => page.locator('.pdf-canvas canvas').evaluate((c: HTMLCanvasElement) => c.width))
    .toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  await expect(page.getByText('Slide 2 / 12')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('.pdf-canvas canvas').evaluate((canvas: HTMLCanvasElement) => {
        const pixels = canvas
          .getContext('2d')!
          .getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i + 3] > 0 && pixels[i] < 150) return true;
        return false;
      }),
    )
    .toBe(true);
  await page.screenshot({ path: 'test-results/learning-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('Shared chat link')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'test-results/learning-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Shared chat link').fill('https://example.com/private');
  await page.getByRole('button', { name: 'Import conversation', exact: true }).click();
  await expect(page.getByText(/Only public ChatGPT, Gemini and Claude share links/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to creation task' })).toBeDisabled();
  await page.getByLabel('Choose transcript').setInputFiles({
    name: 'study.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(transcript),
  });
  await expect(
    page.getByText('Conversation ready. Check the preview before confirming.'),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Conversation ready. Check the preview before confirming.'),
  ).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue to creation task' }).click();
  await page.getByRole('button', { name: /Choose essay/ }).click();
  await page.getByLabel('Choose essay').setInputFiles({
    name: 'essay.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: await essayDocx(),
  });
  await expect(page.getByText(/words before bibliography/)).toBeVisible();
  await page.getByRole('button', { name: 'I used AI', exact: true }).click();
  await page.getByLabel('Choose transcript').setInputFiles({
    name: 'creation.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(transcript),
  });
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Submit assessment', exact: true }).click();
  await expect(page.getByRole('heading', { name: /You’ve completed/ })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator('.profile-demo-note')).toContainText(
    'Practical results and feedback are illustrative.',
  );
  const report = (await (await page.request.get('/api/attempt')).json()).report;
  expect(report.capabilities).toHaveLength(25);
  for (const [id, answer] of Object.entries(expectedAnswers)) {
    const key = quizKey[id];
    const result = report.capabilities.find((c: any) => c.id === key.capability);
    expect(result.quiz).toBe((key.points[answer] / key.max) * 100);
  }
  expect((await (await page.request.get('/api/attempt')).json()).quizOrder).toEqual(startingOrder);
  expect(report.deliverable.verdict).toBe('Pass');
  expect(
    (
      await page.request.patch('/api/answers', {
        data: { stage: 'quiz', id: 'Q01', value: 'A', cursor: 0 },
      })
    ).status(),
  ).toBe(409);
  await page.request.delete('/api/attempt');
});

test('natural study brief, resilient slides and no-AI submissions preserve unobserved capabilities', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seedToTasks(page.request, 'Natural study test');
  await page.goto('/');
  await page.getByRole('button', { name: 'Resume assessment' }).click();
  await expect(
    page.getByText(/This semester, you've enrolled in an "Intro to Cognitive Science" module/),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Topics to study' })).toBeVisible();
  await expect(page.getByText('Memory systems', { exact: true })).toBeVisible();
  await expect(page.locator('.task-page')).not.toContainText('ChatGPT');
  await expect(page.locator('.task-page')).not.toContainText('(slide');
  await expect(
    page.getByText(
      'If you have any trouble submitting, please contact the study organizers for help.',
      { exact: false },
    ),
  ).toBeVisible();
  await expect(page.getByText('Preparing your transcript', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'How this is assessed' })).toHaveCount(0);
  await expect(page.getByLabel('Full conversation text')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/learning-brief-desktop.png', fullPage: true });
  await page.getByRole('tab', { name: 'Study slides' }).click();
  await expect(page.locator('.pdf-canvas canvas')).toBeVisible();
  for (let i = 0; i < 5; i++)
    await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.pdf-canvas canvas')).toBeVisible();
  await expect(page.getByText('Slide 6 / 12')).toBeVisible();
  expect(
    await page.locator('.pdf-canvas canvas').evaluate((c: HTMLCanvasElement) => {
      const p = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let ink = 0;
      for (let i = 0; i < p.length; i += 4) if (p[i + 3] && p[i] < 150) ink++;
      return ink;
    }),
  ).toBeGreaterThan(100);
  await page.getByRole('tab', { name: 'Brief', exact: true }).click();
  await page.getByRole('button', { name: 'I did not use AI', exact: true }).click();
  await page
    .getByLabel('How did you study?')
    .fill(
      'I reviewed the slides and recalled each concept without looking, then checked my notes.',
    );
  await expect(page.getByRole('button', { name: 'Continue to creation task' })).toBeDisabled();
  await page.getByRole('button', { name: 'Save account' }).click();
  await expect(page.getByText('Account saved.', { exact: true })).toBeVisible();
  await page
    .getByLabel('How did you study?')
    .fill('I reviewed the slides and tested myself on the memory systems.');
  await expect(page.getByRole('button', { name: 'Continue to creation task' })).toBeDisabled();
  await page.getByRole('button', { name: 'Save account' }).click();
  await page.reload();
  await expect(page.getByLabel('How did you study?')).toHaveValue(
    'I reviewed the slides and tested myself on the memory systems.',
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'test-results/learning-no-ai-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Continue to creation task' }).click();
  await page.getByRole('button', { name: /Choose essay/ }).click();
  await page.getByRole('tab', { name: 'Deliverable rubric' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What to submit' })).toHaveCount(0);
  await page.getByLabel('Choose essay').setInputFiles({
    name: 'essay.docx',
    mimeType: 'application/octet-stream',
    buffer: await essayDocx(),
  });
  await page.getByRole('button', { name: 'I did not use AI', exact: true }).click();
  await page
    .getByLabel('How did you complete the task?')
    .fill('I planned the argument, read two sources, wrote and proofread the essay myself.');
  await page.getByRole('button', { name: 'Save account' }).click();
  await page.getByRole('button', { name: 'Submit assessment', exact: true }).click();
  await expect(page.getByRole('heading', { name: /You’ve completed/ })).toBeVisible({
    timeout: 30000,
  });
  const report = (await (await page.request.get('/api/attempt')).json()).report;
  expect(report.capabilities.find((c: any) => c.id === 'L1').score).toBe(
    report.capabilities.find((c: any) => c.id === 'L1').quiz,
  );
  const r5 = report.capabilities.find((c: any) => c.id === 'R5');
  expect(r5.score).toBe(r5.quiz);
  expect(errors).toEqual([]);
  await page.request.delete('/api/attempt');
});

test('coding route, rejected uploads, fixed code checks, review audit and session isolation', async ({
  page,
  playwright,
}) => {
  await seedToTasks(page.request, 'Coding integration');
  const bad = await page.request.post('/api/upload/learning', {
    multipart: {
      file: {
        name: 'bad.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('no identifiable roles'),
      },
    },
  });
  expect(bad.status()).toBe(200);
  expect((await bad.json()).uploads.learning.parseStatus).toBe('needs_review');
  await upload(page.request, 'learning', 'study.txt', Buffer.from(transcript));
  await page.request.post('/api/stage/submit');
  await page.request.post('/api/pathway', { data: { pathway: 'coding' } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Resume assessment' }).click();
  const source = page.getByRole('link', { name: 'Codeforces (1399B)', exact: true });
  await expect(source).toHaveAttribute('href', 'https://codeforces.com/problemset/problem/1399/B');
  await expect(page.getByRole('tab', { name: 'Deliverable rubric', exact: true })).toHaveCount(0);
  await expect(
    page.getByText('Comments and written explanations are not required.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Problem', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Codeforces 1399B: Gifts Fixing', exact: true }),
  ).toHaveAttribute('href', 'https://codeforces.com/problemset/problem/1399/B');
  await expect(page.getByRole('heading', { name: 'B. Gifts Fixing', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Note', exact: true })).toBeVisible();
  await expect(page.locator('.prose pre')).toHaveCount(2);
  expect(await page.locator('.coding-problem .katex').count()).toBeGreaterThan(30);
  await expect(page.locator('.coding-problem .katex-error')).toHaveCount(0);
  for (const phrase of ['one candy', 'one orange', 'minimum']) {
    const emphasis = page
      .locator('.coding-problem strong')
      .filter({ hasText: new RegExp(`^${phrase}$`) });
    await expect(emphasis).toHaveCount(2);
    await expect(emphasis.first()).toHaveCSS('font-weight', '700');
  }
  await expect(
    page.locator('.coding-problem strong').filter({ hasText: /^not necessary$/ }),
  ).toBeVisible();
  await expect(page.locator('.coding-problem math').first()).toBeAttached();
  expect(await page.locator('.coding-problem .katex-html .msupsub').count()).toBeGreaterThan(10);
  await page.screenshot({ path: 'test-results/coding-problem-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'test-results/coding-problem-mobile.png', fullPage: true });
  await page.getByRole('tab', { name: 'Problem', exact: true }).press('ArrowLeft');
  await expect(page.getByRole('heading', { name: 'Your assignment', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await upload(
    page.request,
    'deliverable',
    'solution.py',
    Buffer.from(solution.replace(/^#.*\n/gm, '')),
  );
  await upload(page.request, 'creation', 'creation.txt', Buffer.from(transcript));
  await page.request.post('/api/stage/submit');
  await expect
    .poll(async () => (await (await page.request.get('/api/attempt')).json()).stage, {
      timeout: 40000,
    })
    .toBe('results');
  const a = await (await page.request.get('/api/attempt')).json();
  expect(a.report.deliverable.checks.code.status).toBe('Pass');
  expect(a.report.deliverable.verdict).toBe('Pass');
  expect(a.report.deliverable.criteria.map((c: any) => c.id)).toEqual(['tests']);
  const exportedFolder = path.join(runExportDir, 'demo', a.id);
  const exported = JSON.parse(fs.readFileSync(path.join(exportedFolder, 'run.json'), 'utf8'));
  expect(exported.report.deliverable.checks.code.status).toBe('Pass');
  expect(exported.report.deliverable.checks.code.cases).toBe(100);
  expect(fs.readFileSync(path.join(exportedFolder, 'creation_output.py'), 'utf8')).toBe(
    solution.replace(/^#.*\n/gm, ''),
  );
  expect(fs.readFileSync(path.join(exportedFolder, 'creation_transcript.txt'), 'utf8')).toContain(
    'attention affects memory',
  );
  const other = await playwright.request.newContext({
    baseURL: process.env.BASE_URL || 'http://localhost:4174',
  });
  expect(await (await other.get('/api/attempt')).json()).toBeNull();
  await other.dispose();
  expect((await page.request.get('/api/review')).status()).toBe(401);
  const token = fs.readFileSync(`${process.env.DATA_DIR || '.data'}/reviewer-token`, 'utf8').trim();
  const review = await page.request.post(`/api/review/${a.id}`, {
    headers: { 'x-reviewer-token': token },
    data: {
      capability: 'L1',
      task: 'learning',
      score: 1,
      reason: 'Test adjudication using the first student turn.',
    },
  });
  expect(review.ok()).toBeTruthy();
  const reviewed = await review.json();
  expect(reviewed.report.audit).toHaveLength(1);
  expect(reviewed.report.audit[0].previous.score).toBe(0.4);
  const correctedExport = JSON.parse(
    fs.readFileSync(path.join(exportedFolder, 'run.json'), 'utf8'),
  );
  expect(correctedExport.report.audit).toHaveLength(1);
  expect(
    correctedExport.report.capabilities
      .find((c: any) => c.id === 'L1')
      .observations.find((o: any) => o.task === 'learning').score,
  ).toBe(1);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /You’ve completed/ })).toBeVisible();
  await page.request.delete('/api/attempt');
  expect(fs.existsSync(exportedFolder)).toBeTruthy();
  // Manually remove this synthetic research archive after verifying session deletion retains it.
  fs.rmSync(exportedFolder, { recursive: true, force: true });
});

test('questionnaire countdowns persist and allow answers after suggested time', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Start assessment', exact: true }).click();
  await page.getByLabel('What should we call you?').fill('Timer test');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: "Let's begin" }).click();
  await expect(page.getByRole('timer')).toContainText(/(?:7:00|6:\d{2})/);
  await page.clock.fastForward(421000);
  await expect(page.getByRole('timer')).toContainText('0:00');
  await expect(page.getByRole('timer')).toHaveCSS('color', 'rgb(180, 35, 24)');
  await page.getByRole('radio').nth(2).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  await page.reload();
  await expect(page.getByRole('timer')).toContainText('0:00');
  const content = await (await page.request.get('/api/content')).json();
  for (const q of content.self)
    await page.request.patch('/api/answers', {
      data: { stage: 'self', id: q.id, value: 3, cursor: 0 },
    });
  await page.request.post('/api/stage/submit');
  await page.clock.setSystemTime(new Date());
  await page.reload();
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
  await expect(page.getByRole('timer')).toContainText(/(?:20:00|19:\d{2})/);
  await page.clock.fastForward(1201000);
  await expect(page.getByRole('timer')).toContainText('0:00');
  await expect(page.getByRole('timer')).toHaveCSS('color', 'rgb(180, 35, 24)');
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  await page.request.delete('/api/attempt');
});

test('start fresh clears the saved attempt and reloads the entire experience', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start assessment', exact: true }).click();
  await page.getByLabel('What should we call you?').fill('Fresh start test');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: "Let's begin" }).click();
  await page.getByRole('radio').nth(2).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'AI Competency home' }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
  expect(await (await page.request.get('/api/attempt')).json()).not.toBeNull();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start assessment', exact: true })).toBeVisible();
  expect(await (await page.request.get('/api/attempt')).json()).toBeNull();
  await expect(page.getByRole('button', { name: 'Start fresh', exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Start assessment', exact: true }).click();
  await expect(page.getByLabel('What should we call you?')).toHaveValue('');
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.getByLabel('What should we call you?').fill('Fresh replacement test');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: "Let's begin" }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  expect(
    await page
      .getByRole('radio')
      .evaluateAll((nodes) => nodes.some((n) => (n as HTMLInputElement).checked)),
  ).toBe(false);
  const attempt = await (await page.request.get('/api/attempt')).json();
  expect(attempt.self).toEqual({});
  expect(attempt.quiz).toEqual({});
  expect(attempt.uploads).toEqual({});
  expect(attempt.report).toBeNull();
  await page.request.delete('/api/attempt');
});

test('mobile entrance, reduced motion, questionnaire and profile layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play installation' })).toBeVisible();
  await expect(page.locator('.light-field canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/landing-mobile.png', fullPage: true });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.getByRole('button', { name: 'Start assessment', exact: true }).click();
  await page.getByLabel('What should we call you?').fill('Mobile student');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: "Let's begin" }).click();
  await expect(page.locator('.question-instruction')).toHaveCount(0);
  await expect(page.locator('.question-note')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Skip', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Not sure', exact: true }).locator('svg'),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Not sure', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.screenshot({ path: 'test-results/question-mobile.png', fullPage: true });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.getByRole('button', { name: 'AI Competency home' }).click();
  await page.getByRole('link', { name: 'Explore the study' }).click();
  await expect(
    page.getByRole('heading', { name: 'Understanding how students use AI.' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Learn', exact: true }).click();
  await page.screenshot({ path: 'test-results/vision-mobile.png', fullPage: true });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.request.delete('/api/attempt');
});
