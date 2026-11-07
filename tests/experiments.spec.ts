import { expect, test } from '@playwright/test';

test('experiments opens directly to the working panels on desktop and mobile', async ({
  page,
}) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Experiments', exact: true }).click();

    const workspace = page.getByRole('region', { name: 'Mathematical shader experiments' });
    await expect(workspace.locator('.experiment-intro')).toHaveCount(0);
    await expect(workspace.getByRole('heading', { name: 'Scalar field editor' })).toBeVisible();
    await expect(
      workspace.getByRole('heading', { name: 'Scalar field · f(x,y,t,a,b)' }),
    ).toBeVisible();
    await expect(workspace.getByRole('textbox', { name: 'f(x, y, t, a, b)' })).toBeVisible();

    const headerBottom = await page
      .locator('.site-header')
      .evaluate((element) => element.getBoundingClientRect().bottom);
    const firstPanelTop = await workspace
      .locator('.experiment-controls')
      .evaluate((element) => element.getBoundingClientRect().top);
    expect(firstPanelTop - headerBottom).toBeGreaterThanOrEqual(0);
    expect(firstPanelTop - headerBottom).toBeLessThanOrEqual(32);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
