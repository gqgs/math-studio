import { describe, expect, it } from 'vitest';
import {
  diagnosticLine,
  formulaDocument,
  insertSymbol,
  PREAMBLE,
  splitFormulas,
  WRAPPER_LINES,
} from './math';
import { SYMBOLS } from './symbols';

describe('formula blocks', () => {
  it('groups single newlines into cells and splits on whitespace-only blank lines', () => {
    const source = ' \n\nx = 1\ny = 2\n \t\n\nalpha + beta\n\n';
    const blocks = splitFormulas(source);
    expect(blocks.map((block) => block.source)).toEqual(['x = 1\ny = 2', 'alpha + beta']);
    expect(blocks.map((block) => block.startLine)).toEqual([3, 7]);
    expect(source.slice(blocks[1].start, blocks[1].end)).toBe('alpha + beta');
  });
  it('handles CRLF, empty input, and one optional outer delimiter pair', () => {
    expect(splitFormulas(' \r\n \t\r\n')).toEqual([]);
    expect(splitFormulas('$ x^2\r\nalpha $\r\n \r\n$ beta $').map((block) => block.source)).toEqual(
      ['x^2\r\nalpha', 'beta'],
    );
    expect(splitFormulas('x + "$"')[0].source).toBe('x + "$"');
  });
  it('maps diagnostics out of the wrapper and clamps end-of-formula errors', () => {
    const block = splitFormulas('a\n\n $ x\nfrac( $')[1];
    expect(diagnosticLine(`${WRAPPER_LINES}:1`, block)).toBe(3);
    expect(diagnosticLine(`${WRAPPER_LINES + 1}:2`, block)).toBe(4);
    expect(diagnosticLine('100:1', block)).toBe(4);
    expect(diagnosticLine('', block)).toBe(3);
  });
});

describe('visible line breaks', () => {
  it('renders input newlines as math breaks without changing source line numbers', () => {
    expect(formulaDocument('x+2\r\ny+2')).toBe(PREAMBLE + 'x+2\n\\ y+2\n$');
  });
  it('does not duplicate an explicit Typst line break', () => {
    const source = 'x &= 1 \\\ny &= 2';
    expect(formulaDocument(source)).toBe(PREAMBLE + source + '\n$');
  });
  it('keeps visible breaks after trailing comments', () => {
    expect(formulaDocument('x // note\ny')).toBe(PREAMBLE + 'x // note\n\\ y\n$');
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
