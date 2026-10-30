import { describe, expect, it } from 'vitest';
import { parseExpression } from './expression';
import { PRESETS } from './catalog';

describe('scalar expression parser', () => {
  it('parses every built-in shader preset', () => {
    for (const preset of PRESETS) {
      expect(['binary', 'call']).toContain(parseExpression(preset.formula).kind);
    }
  });

  it('preserves exponent precedence and right associativity', () => {
    expect(parseExpression('-x^2')).toEqual({
      kind: 'unary', op: '-',
      argument: {
        kind: 'binary', op: '^',
        left: { kind: 'variable', name: 'x' },
        right: { kind: 'number', value: 2 },
      },
    });
    const rightAssociative = parseExpression('2^3^2');
    expect(rightAssociative.kind).toBe('binary');
    if (rightAssociative.kind === 'binary') {
      expect(rightAssociative.right.kind).toBe('binary');
    }
  });

  it('accepts variables, constants, nested functions and scientific notation', () => {
    const result = parseExpression('sin(pi*x + 1e-3*a) + max(abs(-y), sqrt(b)) - log(e)');
    expect(result.kind).toBe('binary');
  });

  it('rejects arbitrary JS, unknown names, malformed input and invalid arguments', () => {
    for (const source of [
      '', 'x; alert(1)', 'window.location', 'constructor(x)',
      'sin(x,y)', 'min(x)', 'x +', '2x', 'x**2', 'sin((x)',
      'pow(x,)', '1e999', 'x'.repeat(601), 'sin x',
      '__proto__(x)', 'x[0]', 'x ? 1 : 0',
    ]) {
      expect(() => parseExpression(source), source).toThrow();
    }
  });

  it('bounds AST size and nesting', () => {
    expect(() => parseExpression(Array.from({ length: 140 }, () => 'x').join('+'))).toThrow();
    expect(() => parseExpression('('.repeat(33) + 'x' + ')'.repeat(33))).toThrow();
  });
});
