import { test, expect } from '@playwright/test';
import { EXAMPLES } from '../src/math';
import { SYMBOLS } from '../src/symbols';
import AxeBuilder from '@axe-core/playwright';

test('renders real math locally and presents a complete desktop workspace', async ({ page }) => {
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
  await expect(page.getByText('All formulas rendered')).toBeVisible();
  await expect(page.getByRole('img', { name: /^Formula:/ })).toHaveCount(3);
  expect(
    await page
      .getByRole('img', { name: /^Formula:/ })
      .evaluateAll((images) =>
        images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
      ),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
});

test('renders every bundled example and palette template', async ({ page }) => {
  await page.goto('/');
  const examples = EXAMPLES.map((item) => item.source);
  const templates = SYMBOLS.map((item) => item.template.replaceAll(/\{\{|\}\}/g, ''));
  await page
    .getByRole('textbox', { name: 'Math formulas' })
    .fill([...examples, ...templates].join('\n\n'));
  await expect(page.getByText('All formulas rendered')).toBeVisible({ timeout: 50_000 });
  await expect(page.getByRole('img', { name: /^Formula:/ })).toHaveCount(
    examples.length + templates.length,
  );
  await expect(page.locator('.formula-error')).toHaveCount(0);
});

test('keeps valid formulas visible, maps errors to source, and recovers', async ({ page }) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: 'Math formulas' });
  await editor.fill('x^2\n\nfrac(\n\nalpha + beta');
  await expect(page.getByRole('img', { name: /^Formula:/ })).toHaveCount(2);
  await expect(page.locator('.formula-error')).toHaveCount(1);
  await page.getByRole('button', { name: 'Check line 3' }).click();
  await expect(editor).toBeFocused();
  await editor.fill('x^2\n\nfrac(1, 2)\n\nalpha + beta');
  await expect(page.getByText('All formulas rendered')).toBeVisible();
  await expect(page.getByRole('img', { name: /^Formula:/ })).toHaveCount(3);
});

test('inserts at the remembered selection and supports undo, redo, and clear', async ({ page }) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: 'Math formulas' });
  await editor.fill('a + b');
  await editor.selectText();
  await page.getByRole('button', { name: 'Insert Square root', exact: true }).click();
  await expect(editor).toHaveValue('sqrt(a + b)');
  await expect(editor).toBeFocused();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(editor).toHaveValue('a + b');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(editor).toHaveValue('sqrt(a + b)');
  await page.getByRole('button', { name: 'Clear formulas' }).click();
  await expect(editor).toHaveValue('');
  await expect(page.getByText('Every idea starts somewhere.')).toBeVisible();
  await editor.press('Control+z');
  await expect(editor).toHaveValue('sqrt(a + b)');
});

test('searches symbols, inserts examples without losing text, and restores a draft', async ({
  page,
}) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: 'Math formulas' });
  await editor.fill('x^2');
  await page.getByRole('textbox', { name: 'Search symbols' }).fill('lambda');
  await expect(page.locator('.symbol-grid button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Insert Lambda', exact: true }).click();
  await expect(editor).toHaveValue('x^2 lambda');
  await page.getByRole('button', { name: 'Start with an example' }).click();
  await page.getByRole('button', { name: /Euler’s identity/ }).click();
  await expect(editor).toHaveValue('x^2 lambda\n\ne^(i pi) + 1 = 0');
  await expect(page.getByText('Draft saved in this browser')).toBeVisible();
  await page.reload();
  await expect(editor).toHaveValue('x^2 lambda\n\ne^(i pi) + 1 = 0');
  await page.getByRole('button', { name: 'Clear formulas' }).click();
  await expect(page.getByText('Draft saved in this browser')).toBeVisible();
  await page.reload();
  await expect(editor).toHaveValue('');
});

test('honors IME composition and the latest edit', async ({ page }) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: 'Math formulas' });
  await expect(page.getByText('All formulas rendered')).toBeVisible();
  await editor.dispatchEvent('compositionstart');
  await editor.fill('alpha + beta');
  await page.waitForTimeout(300);
  await expect(page.getByRole('img', { name: 'Formula: alpha + beta', exact: true })).toHaveCount(
    0,
  );
  await editor.dispatchEvent('compositionend');
  await expect(page.getByRole('img', { name: 'Formula: alpha + beta', exact: true })).toBeVisible();
  await editor.fill('frac(');
  await editor.fill('sqrt(');
  await editor.fill('x^3 + 2');
  await expect(page.getByRole('img', { name: 'Formula: x^3 + 2', exact: true })).toBeVisible();
  await expect(page.locator('.formula-error')).toHaveCount(0);
});

test('supports mobile, keyboard dialogs, zoom, and source navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText('All formulas rendered')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Syntax guide' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Syntax guide' })).toBeFocused();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reset zoom', exact: true })).toHaveText('110%');
  await page.getByRole('button', { name: 'Reset zoom', exact: true }).click();
  await page.getByRole('button', { name: 'Edit formula 2', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Math formulas' })).toBeFocused();
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});

test('recovers from unavailable renderer assets and keeps editing available', async ({ page }) => {
  await page.route('**/*.wasm', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Retry renderer' })).toBeVisible();
  const editor = page.getByRole('textbox', { name: 'Math formulas' });
  await editor.fill('x^2');
  await page.unroute('**/*.wasm');
  await page.getByRole('button', { name: 'Retry renderer' }).click();
  await expect(page.getByRole('img', { name: 'Formula: x^2', exact: true })).toBeVisible();
});

test('reports unavailable local storage without breaking editing', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Storage unavailable');
    };
  });
  await page.goto('/');
  await expect(page.getByText('Draft could not be saved — copy it to keep it')).toBeVisible();
  await page.getByRole('textbox', { name: 'Math formulas' }).fill('sqrt(2)');
  await expect(page.getByRole('img', { name: 'Formula: sqrt(2)', exact: true })).toBeVisible();
});

test('provides accessible contrast, names, and dialog structure', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('All formulas rendered')).toBeVisible();
  const audit = async () => {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map((violation) => ({
        rule: violation.id,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          message: node.failureSummary,
        })),
      })),
    ).toEqual([]);
  };
  await audit();
  await page.getByRole('button', { name: 'Syntax guide' }).click();
  await audit();
});
