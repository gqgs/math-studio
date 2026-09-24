import { test, expect, type Locator } from '@playwright/test';
import { EXAMPLES } from '../src/math';
import { SYMBOLS } from '../src/symbols';
import AxeBuilder from '@axe-core/playwright';

async function expectSource(editor: Locator, text: string) {
  await expect
    .poll(() =>
      editor.locator('.cm-line').evaluateAll((lines) =>
        lines
          .map((line) => {
            const copy = line.cloneNode(true) as HTMLElement;
            copy.querySelectorAll('.cm-placeholder').forEach((placeholder) => placeholder.remove());
            return copy.textContent;
          })
          .join('\n'),
      ),
    )
    .toBe(text);
}

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

test('CodeMirror preserves single-line breaks and blank-line cell boundaries while typing', async ({
  page,
}) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: 'Math formulas' });
  await editor.fill('x+2');
  await editor.press('End');
  await editor.press('Enter');
  await editor.pressSequentially('y+2');
  await expectSource(editor, 'x+2\ny+2');
  await expect(page.getByText('All formulas rendered')).toBeVisible();
  await expect(page.getByTestId('formula-card')).toHaveCount(1);
  await editor.press('Enter');
  await editor.press('Enter');
  await editor.pressSequentially('z+3');
  await expectSource(editor, 'x+2\ny+2\n\nz+3');
  await expect(page.getByText('All formulas rendered')).toBeVisible();
  await expect(page.getByTestId('formula-card')).toHaveCount(2);
  await editor.press('Home');
  await editor.press('Backspace');
  await expectSource(editor, 'x+2\ny+2\nz+3');
  await expect(page.getByTestId('formula-card')).toHaveCount(1);
  await editor.press('Control+z');
  await expectSource(editor, 'x+2\ny+2\n\nz+3');
  await expect(page.getByTestId('formula-card')).toHaveCount(2);
});

test('highlights math, completes snippets, and always uses Enter for a newline', async ({
  page,
}) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: 'Math formulas' });
  await editor.fill('sqrt(2) + alpha');
  await expect(editor.locator('.math-function')).toHaveText('sqrt');
  await expect(editor.locator('.math-function')).toHaveCSS('color', 'rgb(35, 98, 73)');
  await expect(editor.locator('.math-number')).toHaveText('2');
  await expect(editor.locator('.math-symbol')).toHaveText('alpha');
  await editor.fill('fra');
  await editor.press('Control+Space');
  await expect(page.getByRole('option', { name: /frac/ })).toBeVisible();
  await editor.press('Tab');
  await expectSource(editor, 'frac(a, b)');
  await editor.pressSequentially('x');
  await editor.press('Tab');
  await editor.pressSequentially('2');
  await expectSource(editor, 'frac(x, 2)');
  await expect(page.getByText('All formulas rendered')).toBeVisible();
  await editor.fill('alp');
  await editor.press('Control+Space');
  await expect(page.getByRole('option', { name: /alpha/ })).toBeVisible();
  await editor.press('Enter');
  await expectSource(editor, 'alp\n');
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('supports bracket closing, search shortcuts, and compiler error underlines', async ({
  page,
}) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: 'Math formulas' });
  await editor.fill('');
  await editor.pressSequentially('sqrt(');
  await expectSource(editor, 'sqrt()');
  await editor.pressSequentially('2)');
  await expectSource(editor, 'sqrt(2)');
  await editor.press('Control+f');
  await expect(page.locator('.cm-search')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(editor).toBeFocused();
  await editor.fill('x\ny\n\nalpha\nfrac(');
  await expect(editor.locator('.cm-lintRange-error')).toHaveText('frac(');
  await page.getByRole('button', { name: 'Check line 5' }).click();
  await expect(editor).toBeFocused();
  await editor.fill('x\ny\n\nalpha\nfrac(1, 2)');
  await expect(page.getByText('All formulas rendered')).toBeVisible();
  await expect(editor.locator('.cm-lintRange-error')).toHaveCount(0);
});

test('renders single newlines within a cell and blank lines as separate cells', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  const lines = ['x+2', 'y+2', 'y+4', 'y+5', 'y+6', 'y+7', 'y+8', 'y+10'];
  await page.getByRole('textbox', { name: 'Math formulas' }).fill(lines.join('\n') + '\n\nz+1');
  await expect(page.getByText('All formulas rendered')).toBeVisible();
  const images = page.getByRole('img', { name: /^Formula:/ });
  await expect(images).toHaveCount(2);
  const tall = await images.nth(0).boundingBox();
  const short = await images.nth(1).boundingBox();
  expect(tall!.height).toBeGreaterThan(short!.height * 5);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/grouped-lines.png' });
});

test('keeps editing and the active preview in view as cells and lines grow', async ({ page }) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1024, height: 600 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const editor = page.getByRole('textbox', { name: 'Math formulas' });
    const paper = page.getByRole('region', { name: 'Rendered formulas' });
    const cells = Array.from({ length: 16 }, (_, index) => `x + ${index}`);
    await editor.fill(cells.join('\n\n'));
    await expect(page.getByText('All formulas rendered')).toBeVisible();
    await expect(page.getByTestId('formula-card').last()).toBeInViewport();
    await expect(editor).toBeInViewport();
    expect(await paper.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1),
    ).toBe(true);
    await editor.fill(Array.from({ length: 45 }, (_, index) => `x + ${index}`).join('\n'));
    await expect(page.getByText('All formulas rendered')).toBeVisible();
    await expect(page.getByTestId('formula-card')).toHaveCount(1);
    await expect.poll(() => paper.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    // Moving back to the start follows the first rendered line without moving the page.
    await editor.press('Control+Home');
    await expect.poll(() => paper.evaluate((element) => element.scrollTop)).toBeLessThan(30);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: `test-results/viewport-${viewport.width}.png` });
  }
});

test('keeps valid formulas visible, maps errors to source, and recovers', async ({ page }) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: 'Math formulas' });
  await editor.fill('x^2\n\nalpha\nfrac(\n\nbeta');
  await expect(page.getByRole('img', { name: /^Formula:/ })).toHaveCount(2);
  await expect(page.locator('.formula-error')).toHaveCount(1);
  await page.getByRole('button', { name: 'Check line 4' }).click();
  await expect(editor).toBeFocused();
  await editor.fill('x^2\n\nalpha\nfrac(1, 2)\n\nbeta');
  await expect(page.getByText('All formulas rendered')).toBeVisible();
  await expect(page.getByRole('img', { name: /^Formula:/ })).toHaveCount(3);
});

test('inserts at the remembered selection and supports undo, redo, and clear', async ({ page }) => {
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: 'Math formulas' });
  await editor.fill('a + b');
  await editor.selectText();
  await page.getByRole('button', { name: 'Insert Square root', exact: true }).click();
  await expectSource(editor, 'sqrt(a + b)');
  await expect(editor).toBeFocused();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectSource(editor, 'a + b');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expectSource(editor, 'sqrt(a + b)');
  await page.getByRole('button', { name: 'Clear formulas' }).click();
  await expectSource(editor, '');
  await expect(page.getByText('Every idea starts somewhere.')).toBeVisible();
  await editor.press('Control+z');
  await expectSource(editor, 'sqrt(a + b)');
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
  await expectSource(editor, 'x^2 lambda');
  await page.getByRole('button', { name: 'Start with an example' }).click();
  await page.getByRole('button', { name: /Euler’s identity/ }).click();
  await expectSource(editor, 'x^2 lambda\n\ne^(i pi) + 1 = 0');
  await expect(page.getByText('Draft saved in this browser')).toBeVisible();
  await page.reload();
  await expectSource(editor, 'x^2 lambda\n\ne^(i pi) + 1 = 0');
  await page.getByRole('button', { name: 'Clear formulas' }).click();
  await expect(page.getByText('Draft saved in this browser')).toBeVisible();
  await page.reload();
  await expectSource(editor, '');
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
