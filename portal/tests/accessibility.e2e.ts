import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('accessibility on entrance, questionnaire and study vision', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start assessment', exact: true })).toBeVisible();
  const audit = async () => {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(
      r.violations.map((v) => ({
        id: v.id,
        help: v.help,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    ).toEqual([]);
  };
  await audit();
  await page.getByRole('button', { name: 'Start assessment', exact: true }).click();
  await page.getByLabel('What should we call you?').fill('Accessibility test');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: "Let's begin" }).click();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await audit();
  await page.getByRole('button', { name: 'AI Competency home' }).click();
  await page.getByRole('link', { name: 'Explore the study' }).click();
  await expect(
    page.getByRole('heading', { name: 'Understanding how students use AI.' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Evaluate', exact: true }).click();
  await audit();
  await page.request.delete('/api/attempt');
});
