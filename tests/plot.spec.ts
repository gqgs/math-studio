import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('plots formulas, validates input, changes bounds, and preserves both views', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Math formulas' }).fill('a + b');
  await page.getByRole('button', { name: 'Plot formulas', exact: true }).click();
  const first = page.getByRole('textbox', { name: 'Plot formula 1', exact: true });
  await expect(page.getByTestId('plot-curve')).toHaveAttribute('d', /L/);
  await first.fill('sqrt(');
  await expect(first).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('plot-curve')).toHaveAttribute('d', '');
  await first.fill('x^2');
  await page.getByRole('button', { name: 'Add formula' }).click();
  await expect(page.getByTestId('plot-curve')).toHaveCount(2);
  await page.getByLabel('x minimum').fill('20');
  await expect(page.getByText('Enter finite limits', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Reset plot range' }).click();
  await page.getByRole('button', { name: 'Zoom plot in' }).click();
  await expect(page.getByLabel('x minimum')).toHaveValue('-5');
  await page.getByRole('button', { name: 'Write formulas', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Math formulas' })).toContainText('a + b');
  await page.getByRole('button', { name: 'Plot formulas', exact: true }).click();
  await expect(first).toHaveValue('x^2');
  await page.getByRole('button', { name: 'Remove formula 2' }).click();
  await expect(page.getByTestId('plot-curve')).toHaveCount(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('plot view fits mobile and allows scrolling to the graph', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Plot formulas', exact: true }).click();
  const graph = page.getByRole('img', { name: /^Formula graph:/ });
  await graph.scrollIntoViewIfNeeded();
  await expect(graph).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/plot-mobile.png' });
});
