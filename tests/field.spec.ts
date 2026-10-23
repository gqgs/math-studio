import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
  await expect(frame.locator('.topbar #clear-button')).toBeVisible();
  await expect(frame.locator('.sidebar-intro, .breadcrumb, .plot-heading')).toHaveCount(0);
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
    await frame.locator('#preset').selectOption('selkov');
    await expect(frame.locator('.constant-row')).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await frame.locator('html').evaluate((element) => element.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});

test('named constants drive the Selkov field and validate edits', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Vector fields' }).click();
  const frame = page.frameLocator('iframe[title="Interactive vector field and phase portrait"]');
  await frame.locator('#preset').selectOption('selkov');
  await expect(frame.locator('#dx')).toHaveValue('-x + a*y + x^2*y');
  await expect(frame.locator('#dy')).toHaveValue('b - a*y - x^2*y');
  const names = () =>
    frame
      .locator('.constant-name')
      .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
  const values = () =>
    frame
      .locator('.constant-value')
      .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
  await expect.poll(names).toEqual(['a', 'b']);
  const labelStyle = await frame
    .locator('.equation-row > span')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.fontFamily, style.fontSize, style.fontStyle, style.color];
    });
  const constantStyle = await frame
    .locator('.constant-name')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.fontFamily, style.fontSize, style.fontStyle, style.color];
    });
  expect(constantStyle).toEqual(labelStyle);

  const canvas = frame.locator('#plot');
  const before = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  await frame.locator('.constant-value').first().fill('0.2');
  await expect(frame.locator('#error')).toBeHidden();
  await expect
    .poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL()))
    .not.toBe(before);

  await frame.locator('.constant-name').first().fill('k');
  await expect(frame.locator('#error')).toContainText('Unknown name');
  await frame.locator('#dx').fill('-x + k*y + x^2*y');
  await frame.locator('#dy').fill('b - k*y - x^2*y');
  await expect(frame.locator('#error')).toBeHidden();

  await frame.getByRole('button', { name: 'Add constant' }).click();
  await expect.poll(names).toEqual(['k', 'b', 'a']);
  await frame.locator('.constant-name').last().fill('b');
  await expect(frame.locator('#error')).toContainText('defined more than once');
  await frame.locator('.constant-name').last().fill('c');
  await expect(frame.locator('#error')).toBeHidden();
  await frame.locator('.constant-value').last().fill('');
  await expect(frame.locator('#error')).toContainText('finite number');
  await frame.locator('.constant-value').last().fill('1');
  await frame.locator('#dx').fill('-x + k*y + x^2*y + c');
  await frame
    .getByRole('button', { name: /Remove constant/ })
    .last()
    .click();
  await expect(frame.locator('#error')).toContainText('Unknown name');

  await frame.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect.poll(names).toEqual(['a', 'b']);
  await expect.poll(values).toEqual(['0.1', '0.5']);
  await expect(frame.locator('#error')).toBeHidden();
  expect(errors).toEqual([]);
});

test('every preset exposes adjustable coefficients with its original defaults', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Vector fields' }).click();
  const frame = page.frameLocator('iframe[title="Interactive vector field and phase portrait"]');
  await expect(frame.locator('#path-count')).toHaveText('5 paths');
  const canvas = frame.locator('#plot');
  const presets = [
    {
      key: 'pendulum',
      dx: 'y',
      dy: '-g*sin(x) - d*y',
      names: ['g', 'd'],
      values: ['1', '0.35'],
      changed: '1.4',
    },
    {
      key: 'spiral',
      dx: '-a*x - b*y',
      dy: 'b*x - a*y',
      names: ['a', 'b'],
      values: ['0.28', '1'],
      changed: '0.5',
    },
    {
      key: 'predator',
      dx: 'a*x - b*x*y',
      dy: 'c*x*y - d*y',
      names: ['a', 'b', 'c', 'd'],
      values: ['1', '1', '1', '1'],
      changed: '1.5',
    },
    {
      key: 'vanderpol',
      dx: 'y',
      dy: 'mu*(1-x^2)*y-x',
      names: ['mu'],
      values: ['1.4'],
      changed: '2',
    },
    {
      key: 'selkov',
      dx: '-x + a*y + x^2*y',
      dy: 'b - a*y - x^2*y',
      names: ['a', 'b'],
      values: ['0.1', '0.5'],
      changed: '0.2',
    },
  ];
  for (const preset of presets) {
    await frame.locator('#preset').selectOption(preset.key);
    await expect(frame.locator('#dx')).toHaveValue(preset.dx);
    await expect(frame.locator('#dy')).toHaveValue(preset.dy);
    await expect
      .poll(() =>
        frame
          .locator('.constant-name')
          .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)),
      )
      .toEqual(preset.names);
    await expect
      .poll(() =>
        frame
          .locator('.constant-value')
          .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)),
      )
      .toEqual(preset.values);
    await expect(frame.locator('#error')).toBeHidden();
    const before = await canvas.evaluate(async (element: HTMLCanvasElement) => {
      await new Promise(requestAnimationFrame);
      return element.toDataURL();
    });
    await frame.locator('.constant-value').first().fill(preset.changed);
    await expect
      .poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL()))
      .not.toBe(before);
    await expect(frame.locator('#error')).toBeHidden();
  }
});

test('one header theme follows the system and controls every workspace view', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
  await page.getByRole('button', { name: 'Vector fields' }).click();
  const frame = page.frameLocator('iframe[title="Interactive vector field and phase portrait"]');
  await expect(frame.locator('body')).toHaveClass(/dark/);
  await expect(frame.locator('#path-count')).toHaveText('5 paths');
  await expect(frame.locator('#theme-button')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/theme-field-dark.png' });
  const darkCanvas = await frame
    .locator('#plot')
    .evaluate((canvas: HTMLCanvasElement) =>
      Array.from(canvas.getContext('2d')!.getImageData(1, 1, 1, 1).data),
    );

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(frame.locator('body')).not.toHaveClass(/dark/);
  const lightCanvas = await frame.locator('#plot').evaluate(async (canvas: HTMLCanvasElement) => {
    await new Promise(requestAnimationFrame);
    return Array.from(canvas.getContext('2d')!.getImageData(1, 1, 1, 1).data);
  });
  expect(lightCanvas).not.toEqual(darkCanvas);

  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(frame.locator('body')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Plot formulas', exact: true }).click();
  await expect(page.locator('.plot-controls')).toHaveCSS('background-color', 'rgb(32, 40, 36)');
  await page.getByRole('button', { name: 'Write formulas', exact: true }).click();
  await expect(page.locator('.editor-panel')).toHaveCSS('background-color', 'rgb(32, 40, 36)');
  await page.screenshot({ path: 'test-results/theme-dark.png' });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Vector fields' }).click();
  await expect(frame.locator('body')).not.toHaveClass(/dark/);
});


test('magnitude coloring reveals speed while preserving field toggles and numerical edge cases', async ({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Vector fields'}).click();
  const frame=page.frameLocator('iframe[title="Interactive vector field and phase portrait"]');
  const canvas=frame.locator('#plot');
  const before=await canvas.evaluate((el:HTMLCanvasElement)=>el.toDataURL('image/png'));
  await frame.locator('#color-magnitude').check();
  await expect(frame.locator('#magnitude-legend')).toBeVisible();
  await expect(frame.locator('#magnitude-legend')).toContainText('Vector speed |F|');
  await expect.poll(()=>canvas.evaluate((el:HTMLCanvasElement)=>el.toDataURL('image/png'))).not.toBe(before);
  await frame.locator('#show-field').uncheck();
  await expect(frame.locator('#magnitude-legend')).toBeHidden();
  await frame.locator('#show-field').check();
  await expect(frame.locator('#magnitude-legend')).toBeVisible();

  await frame.locator('#dx').fill('0');
  await frame.locator('#dy').fill('0');
  await expect(frame.locator('#error')).toBeHidden();
  await expect(frame.locator('#magnitude-legend')).toContainText('0 – 0');
  await frame.locator('#dx').fill('1');
  await expect(frame.locator('#magnitude-legend')).toContainText('0 – 1');
  await frame.locator('#dx').fill('unknown_name');
  await expect(frame.locator('#magnitude-legend')).toBeHidden();
});

test('hover follows the cached forward/backward branches without breaking click-to-seed',async ({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Vector fields'}).click();
  const frame=page.frameLocator('iframe[title="Interactive vector field and phase portrait"]');
  const canvas=frame.locator('#plot');
  const box=await canvas.boundingBox();
  expect(box).not.toBeNull();
  // Preset viewport: x∈[-7,7], y∈[-3.8,3.8]; first seed (-5,2.5).
  await canvas.hover({position:{x:box!.width*(2/14),y:box!.height*(1.3/7.6)}});
  await expect(frame.locator('#path-hover')).toBeVisible();
  await expect(frame.locator('#path-hover')).toContainText('(-5, 2.5)');
  await frame.locator('#plot-title').hover();
  await expect(frame.locator('#path-hover')).toBeHidden();
  await canvas.click({position:{x:box!.width*.65,y:box!.height*.65}});
  await expect(frame.locator('#path-count')).toHaveText('6 paths');
  await frame.getByRole('button',{name:'Clear paths'}).click();
  await expect(frame.locator('#path-count')).toHaveText('0 paths');
  await expect(frame.locator('#path-hover')).toBeHidden();
});

test('pendulum energy uses forward-time RK4 samples and synchronized cursor', async ({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Vector fields'}).click();
  const frame=page.frameLocator('iframe[title="Interactive vector field and phase portrait"]');
  const panel=frame.locator('#diagnostics-panel');
  await expect(panel).toBeVisible();
  await frame.locator('#diagnostics-panel summary').click();
  await expect(frame.locator('#energy-plot')).toBeVisible();
  type Sample={x:number;y:number;t:number;e:number};
  const read=()=>frame.locator('#plot').evaluate(()=>(
    window as unknown as {pplaneDiagnostics:()=>({g:number;d:number;samples:Sample[]}|null)}
  ).pplaneDiagnostics());
  let data=await read();
  expect(data).not.toBeNull();
  expect(data!.samples.length).toBeGreaterThan(10);
  expect(data!.d).toBeGreaterThan(0);
  for(let i=1;i<data!.samples.length;i++){
    expect(data!.samples[i].t).toBeGreaterThan(data!.samples[i-1].t);
    expect(data!.samples[i].e).toBeLessThanOrEqual(data!.samples[i-1].e+1e-4);
  }
  const energy=frame.locator('#energy-plot'),r=await energy.boundingBox();
  await energy.hover({position:{x:r!.width*.6,y:r!.height*.5}});
  await expect(frame.locator('#energy-readout')).toContainText('t =');

  const damping=frame.locator('.constant-row').nth(1).locator('.constant-value');
  await damping.fill('0');
  data=await read();
  const levels=data!.samples.map(p=>p.e);
  expect(Math.max(...levels)-Math.min(...levels)).toBeLessThan(1e-2);
  await damping.fill('-0.3');
  data=await read();
  expect(data!.samples.at(-1)!.e).toBeGreaterThan(data!.samples[0].e);
  await frame.locator('#dx').fill('-y');
  await expect(panel).toBeHidden();
});
