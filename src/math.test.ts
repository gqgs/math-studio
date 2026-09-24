import { describe, expect, it } from 'vitest';
import { diagnosticLine, insertSymbol, splitFormulas, WRAPPER_LINES } from './math';
import { SYMBOLS } from './symbols';

describe('formula blocks', () => {
  it('preserves multiline expressions while separating whitespace-only blank lines', () => {
    const source = ' \n\nx &= 1 \\\n &= 2\n \t\n\nalpha + beta\n\n';
    const blocks = splitFormulas(source);
    expect(blocks.map((block) => block.source)).toEqual(['x &= 1 \\\n &= 2', 'alpha + beta']);
    expect(blocks.map((block) => block.startLine)).toEqual([3, 7]);
    expect(source.slice(blocks[1].start, blocks[1].end)).toBe('alpha + beta');
  });
  it('handles CRLF, empty input, and one optional outer delimiter pair', () => {
    expect(splitFormulas(' \r\n \t\r\n')).toEqual([]);
    expect(splitFormulas('$ x^2 $\r\n \r\n$ alpha $').map((block) => block.source)).toEqual([
      'x^2',
      'alpha',
    ]);
    expect(splitFormulas('x + "$"')[0].source).toBe('x + "$"');
  });
  it('maps diagnostics out of the wrapper and clamps end-of-formula errors', () => {
    const block = splitFormulas('a\n\n$\n x &= y \\\n z &= q\n$')[1];
    expect(diagnosticLine(`${WRAPPER_LINES}:1`, block)).toBe(4);
    expect(diagnosticLine(`${WRAPPER_LINES + 1}:2`, block)).toBe(5);
    expect(diagnosticLine('100:1', block)).toBe(5);
    expect(diagnosticLine('', block)).toBe(3);
  });
});

describe('symbol insertion', () => {
  const get = (id: string) => SYMBOLS.find((symbol) => symbol.id === id)!;
  it('inserts a named symbol at the cursor without joining identifiers', () => {
    expect(insertSymbol('xy', 1, 1, get('alpha'))).toEqual({ text: 'x alpha y', start: 7, end: 7 });
  });
  it('replaces a selection and selects a structure’s first field', () => {
    expect(insertSymbol('x + old', 4, 7, get('mat'))).toEqual({
      text: 'x + mat(a, b; c, d)',
      start: 8,
      end: 9,
    });
  });
  it('wraps selected expressions without treating replacement characters specially', () => {
    expect(insertSymbol('a + b', 0, 5, get('sqrt')).text).toBe('sqrt(a + b)');
    expect(insertSymbol('"$&"', 0, 4, get('frac')).text).toBe('frac("$&", b)');
  });
  it('places the cursor in the first field without a selection', () => {
    expect(insertSymbol('', 0, 0, get('frac'))).toEqual({ text: 'frac(a, b)', start: 5, end: 6 });
  });
});
