export interface FormulaBlock {
  id: number;
  source: string;
  start: number;
  end: number;
  startLine: number;
  contentStartLine: number;
}

/** Blank lines are an app-level separator; all other syntax belongs to Typst. */
export function splitFormulas(input: string): FormulaBlock[] {
  const blocks: FormulaBlock[] = [];
  const separator = /\r?\n[\t ]*\r?\n(?:[\t ]*\r?\n)*/g;
  let start = 0;
  const add = (end: number) => {
    const raw = input.slice(start, end);
    const leading = raw.length - raw.trimStart().length;
    let source = raw.trim();
    if (!source) return;
    let contentOffset = start + leading;
    if (source.startsWith('$') && source.endsWith('$') && source.length > 1) {
      const inner = source.slice(1, -1);
      contentOffset += 1 + inner.length - inner.trimStart().length;
      source = inner.trim();
    }
    blocks.push({
      id: blocks.length,
      source,
      start: start + leading,
      end: end - (raw.length - raw.trimEnd().length),
      startLine: input.slice(0, start + leading).split('\n').length,
      contentStartLine: input.slice(0, contentOffset).split('\n').length,
    });
  };
  for (const match of input.matchAll(separator)) {
    add(match.index!);
    start = match.index! + match[0].length;
  }
  add(input.length);
  return blocks;
}

export const PREAMBLE =
  '#set page(width: auto, height: auto, margin: 12pt)\n#set text(font: "New Computer Modern Math", size: 20pt)\n$\n';
export const WRAPPER_LINES = PREAMBLE.split('\n').length - 1;
export function formulaDocument(source: string) {
  return PREAMBLE + source + '\n$';
}

export function diagnosticLine(range: string, block: FormulaBlock): number {
  const line = Number.parseInt(range.split(':')[0], 10);
  if (!Number.isFinite(line)) return block.startLine;
  return (
    block.contentStartLine +
    Math.min(block.source.split('\n').length - 1, Math.max(0, line - WRAPPER_LINES))
  );
}

export interface MathSymbol {
  id: string;
  glyph: string;
  name: string;
  category: string;
  template: string;
  keywords?: string;
  wrap?: boolean;
}

export interface Edit {
  text: string;
  start: number;
  end: number;
}

/** Brackets in templates mark the first field selected after insertion. */
export function insertSymbol(text: string, start: number, end: number, symbol: MathSymbol): Edit {
  const selected = text.slice(start, end);
  let template = symbol.template;
  if (symbol.wrap && selected) {
    template = template.replace(/\{\{(.*?)\}\}/s, () => selected);
  }
  const marker = /\{\{(.*?)\}\}/s.exec(template);
  const plain = template.replace(/\{\{(.*?)\}\}/gs, '$1');
  const left =
    start > 0 && /[\p{L}\p{N}_]/u.test(text[start - 1]) && /^[\p{L}\p{N}]/u.test(plain) ? ' ' : '';
  const right =
    end < text.length && /[\p{L}\p{N}]/u.test(text[end]) && /[\p{L}\p{N}]$/u.test(plain) ? ' ' : '';
  const cursor = start + left.length + (marker ? marker.index : plain.length);
  return {
    text: text.slice(0, start) + left + plain + right + text.slice(end),
    start: cursor,
    end: cursor + (marker ? marker[1].length : 0),
  };
}

export const INITIAL_SOURCE =
  'x = (-b +- sqrt(b^2 - 4 a c)) / (2 a)\n\nsum_(k=1)^n k = (n(n + 1)) / 2\n\nA = mat(1, 2; 3, 4)';

export const EXAMPLES = [
  {
    name: 'Quadratic formula',
    description: 'Fractions, roots & powers',
    source: 'x = (-b +- sqrt(b^2 - 4 a c)) / (2 a)',
  },
  {
    name: 'Euler’s identity',
    description: 'A few beautiful constants',
    source: 'e^(i pi) + 1 = 0',
  },
  {
    name: 'Gaussian integral',
    description: 'Integrals & infinity',
    source: 'integral_(-oo)^oo e^(-x^2) dif x = sqrt(pi)',
  },
  { name: 'A matrix', description: 'Rows separated by semicolons', source: 'A = mat(1, 2; 3, 4)' },
  {
    name: 'Aligned equations',
    description: 'Use & to align and \\ to break',
    source: ['(x + 1)^2 &= x^2 + 2x + 1 \\', '  x^2 &= (x + 1)^2 - 2x - 1'].join('\n'),
  },
  {
    name: 'Piecewise function',
    description: 'Different cases, one expression',
    source: 'f(x) = cases(x^2 & "if" x >= 0, -x & "if" x < 0)',
  },
];
