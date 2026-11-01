import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('study narrative stays ordered and its title never overlaps the artwork', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/vision');
  await expect(
    page.getByRole('heading', { name: 'Understanding how students use AI.' }),
  ).toBeVisible();
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const copy = (await page.locator('.vision-hero-copy').boundingBox())!;
    const art = (await page.locator('.vision-hero-art').boundingBox())!;
    expect(copy.x + copy.width <= art.x || copy.y + copy.height <= art.y).toBeTruthy();
    const title = (await page.locator('.vision-hero h1').boundingBox())!;
    expect(title.x + title.width <= art.x || title.y + title.height <= art.y).toBeTruthy();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.vision-hero-art canvas')).toBeVisible();
  // The framed artwork must contain a visible sculpture, rather than rendering offscreen.
  const lit = await page
    .locator('.vision-hero-art canvas')
    .evaluate((canvas: HTMLCanvasElement) => {
      const copy = document.createElement('canvas');
      copy.width = 100;
      copy.height = 80;
      const ctx = copy.getContext('2d')!;
      ctx.drawImage(canvas, 0, 0, 100, 80);
      const data = ctx.getImageData(0, 0, 100, 80).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4)
        if (Math.max(data[i], data[i + 1], data[i + 2]) > 65) count++;
      return count;
    });
  expect(lit).toBeGreaterThan(100);
  await expect(page.locator('.vision-activities > li')).toHaveCount(4);
  await expect(
    page.locator('.vision-perspectives, .vision-profile-flow, .vision-outcome'),
  ).toHaveCount(0);
  await expect(page.locator('.vision-takeaway')).toContainText('strengths and areas to practise');
  for (const name of ['Understand', 'Learn', 'Create', 'Evaluate']) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(page.getByRole('tabpanel')).toContainText('For example');
  }
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    audit.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await page.screenshot({ path: 'test-results/study-refined-desktop.png', fullPage: true });
  await page.locator('.vision-hero').screenshot({ path: 'test-results/study-refined-hero.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/study-refined-mobile.png', fullPage: true });
});
