import { expect, test } from '@playwright/test';

test('vector field tab runs the bundled phase plane and preserves its state', async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (
      !request.url().startsWith('http://127.0.0.1:4173') &&
      !request.url().startsWith('blob:') &&
      !request.url().startsWith('data:')
    )
      external.push(request.url());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Vector fields' }).click();
  const frame = page.frameLocator('iframe[title="Interactive vector field and phase portrait"]');
  await expect(frame.getByRole('heading', { name: 'Damped pendulum' })).toBeVisible();
  await expect(frame.locator('#path-count')).toHaveText('5 paths');
  await frame.getByRole('button', { name: 'Clear paths' }).click();
  await expect(frame.locator('#path-count')).toHaveText('0 paths');
  await frame.locator('#plot').click({ position: { x: 100, y: 100 } });
  await expect(frame.locator('#path-count')).toHaveText('1 path');
  await frame.getByRole('textbox', { name: 'x derivative' }).fill('-y');
  await expect(frame.locator('#preset')).toHaveValue('custom');
  await page.getByRole('button', { name: 'Plot formulas', exact: true }).click();
  await page.getByRole('button', { name: 'Vector fields' }).click();
  await expect(frame.getByRole('textbox', { name: 'x derivative' })).toHaveValue('-y');
  await expect(frame.locator('#path-count')).toHaveText('1 path');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('vector field tab fits a phone viewport', async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Vector fields' }).click();
    const frame = page.frameLocator('iframe[title="Interactive vector field and phase portrait"]');
    await expect(frame.locator('#plot')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await frame.locator('html').evaluate((element) => element.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});
