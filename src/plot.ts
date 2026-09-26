type Expression = (x: number) => number;
const functions: Record<string, Expression> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  floor: Math.floor,
  ceil: Math.ceil,
};

/** A bounded math-only parser. User input is never executed as JavaScript. */
export function compileExpression(source: string): Expression {
  const input = source.trim().replace(/^y\s*=\s*/i, '');
  if (!input) throw new Error('Enter an expression in x.');
  if (input.length > 500) throw new Error('Keep each expression under 500 characters.');
  const tokens = input.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-zA-Z]+|\S/g) ?? [];
  let position = 0;
  function parse(min = 0): Expression {
    const token = tokens[position++];
    let left: Expression;
    if (token === '+' || token === '-') {
      const operand = parse(3);
      left = token === '-' ? (x) => -operand(x) : operand;
    } else if (token === '(') {
      left = parse();
      if (tokens[position++] !== ')') throw new Error('Missing closing parenthesis.');
    } else if (token && /^(?:\d|\.)/.test(token)) {
      const value = Number(token);
      if (!Number.isFinite(value)) throw new Error('Use a finite number.');
      left = () => value;
    } else if (token === 'x') left = (x) => x;
    else if (token === 'pi' || token === 'e') left = () => (token === 'pi' ? Math.PI : Math.E);
    else if (token && Object.hasOwn(functions, token)) {
      if (tokens[position++] !== '(') throw new Error(`Use ${token}(…).`);
      const argument = parse();
      if (tokens[position++] !== ')') throw new Error('Missing closing parenthesis.');
      left = (x) => functions[token](argument(x));
    } else
      throw new Error(token ? `Unknown symbol “${token}”.` : 'Expected a number, x, or function.');
    while (position < tokens.length) {
      const operator = tokens[position];
      const precedence =
        operator === '+' || operator === '-'
          ? 1
          : operator === '*' || operator === '/'
            ? 2
            : operator === '^'
              ? 4
              : 0;
      if (!precedence || precedence < min) break;
      position++;
      const right = parse(precedence + (operator === '^' ? 0 : 1));
      const previous = left;
      left = (x) => {
        const a = previous(x),
          b = right(x);
        switch (operator) {
          case '+':
            return a + b;
          case '-':
            return a - b;
          case '*':
            return a * b;
          case '/':
            return a / b;
          default:
            return a ** b;
        }
      };
    }
    return left;
  }
  const result = parse();
  if (position !== tokens.length)
    throw new Error(`Unexpected “${tokens[position]}”. Use * for multiplication.`);
  return result;
}

export type Bounds = { xMin: number; xMax: number; yMin: number; yMax: number };
export const DEFAULT_BOUNDS: Bounds = { xMin: -10, xMax: 10, yMin: -5, yMax: 5 };
export const WIDTH = 800,
  HEIGHT = 500;

export function plotPath(fn: Expression, bounds: Bounds): string {
  const { xMin, xMax, yMin, yMax } = bounds;
  const scaleY = (y: number) => (HEIGHT * (yMax - y)) / (yMax - yMin);
  let path = '',
    previousY: number | undefined;
  for (let i = 0; i <= WIDTH * 2; i++) {
    const px = i / 2;
    const x = xMin + (px / WIDTH) * (xMax - xMin);
    const py = scaleY(fn(x));
    if (!Number.isFinite(py) || py < -HEIGHT || py > HEIGHT * 2) {
      previousY = undefined;
      continue;
    }
    // Break steep jumps and undefined midpoints instead of bridging vertical asymptotes.
    const midpoint = scaleY(fn(x - (xMax - xMin) / (WIDTH * 4)));
    const connected =
      previousY !== undefined &&
      Number.isFinite(midpoint) &&
      Math.abs(py - previousY) < HEIGHT / 2 &&
      Math.abs(midpoint - (py + previousY) / 2) < 10;
    path += `${connected ? 'L' : 'M'}${px},${py.toFixed(2)} `;
    previousY = py;
  }
  return path;
}

export function ticks(min: number, max: number): number[] {
  const raw = (max - min) / 8;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((n) => n * power).find((n) => n >= raw)!;
  const result: number[] = [];
  for (let i = Math.ceil(min / step); i <= Math.floor(max / step); i++)
    result.push(Number((i * step).toPrecision(10)));
  return result;
}
