import { describe, expect, it } from 'vitest';
import { compileExpression, DEFAULT_BOUNDS, plotPath, ticks } from './plot';

describe('numeric expressions', () => {
  it('handles precedence, right associative powers, unary signs, and scientific notation', () => {
    for (const [source, expected] of [
      ['2+3*4', 14],
      ['2^3^2', 512],
      ['-x^2', -9],
      ['2^-2', 0.25],
      ['1e-3*x', 0.003],
      ['y = (x+1)/2', 2],
    ] as const) {
      expect(compileExpression(source)(3)).toBeCloseTo(expected);
    }
  });
  it('supports constants and nested functions', () => {
    expect(compileExpression('sin(pi/2) + ln(e) + sqrt(abs(-9)) + log(100)')(0)).toBeCloseTo(7);
  });
  it('rejects malformed input and arbitrary code', () => {
    for (const source of [
      '',
      '2x',
      'sin x',
      'sqrt(',
      'x+',
      'x)',
      'alert(1)',
      'constructor(1)',
      'window.location',
      'x;1',
      '1e999',
      'x'.repeat(501),
    ]) {
      expect(() => compileExpression(source), source).toThrow();
    }
  });
  it('leaves undefined values outside the real domain', () => {
    expect(compileExpression('sqrt(x)')(-1)).toBeNaN();
  });
});

describe('plot sampling', () => {
  it('draws continuous curves and splits around poles', () => {
    expect(plotPath(compileExpression('x'), DEFAULT_BOUNDS).match(/M/g)).toHaveLength(1);
    const path = plotPath(compileExpression('1/x'), DEFAULT_BOUNDS);
    expect(path.match(/M/g)).toHaveLength(2);
    expect(path).not.toMatch(/NaN|Infinity/);
    expect(plotPath(compileExpression('sqrt(-1)'), DEFAULT_BOUNDS)).toBe('');
  });
  it('produces readable ticks inside the range', () => {
    expect(ticks(-10, 10)).toEqual([-10, -5, 0, 5, 10]);
    expect(ticks(0.001, 0.002).length).toBeLessThanOrEqual(9);
  });
});
