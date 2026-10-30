/**
 * A bounded, math-only scalar expression parser.
 * It never invokes eval(), Function(), user JavaScript or shader source strings.
 * The AST is translated to TSL by shaderRuntime.js.
 */
export type ExpressionNode =
  | { kind: 'number'; value: number }
  | { kind: 'variable'; name: 'x' | 'y' | 't' | 'a' | 'b' }
  | { kind: 'unary'; op: '-'; argument: ExpressionNode }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: ExpressionNode; right: ExpressionNode }
  | { kind: 'call'; name: string; args: ExpressionNode[] };

const VARIABLES = new Set(['x', 'y', 't', 'a', 'b']);
export const FUNCTIONS: Readonly<Record<string, number>> = {
  sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1,
  abs: 1, sqrt: 1, exp: 1, log: 1, ln: 1, floor: 1, ceil: 1, fract: 1,
  sign: 1, min: 2, max: 2, pow: 2, atan2: 2, clamp: 3, mix: 3,
  smoothstep: 3,
};

type Token = { text: string; pos: number };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[a-zA-Z_][a-zA-Z_0-9]*|[+\-*/^(),]/y;
  for (let pos = 0; pos < source.length;) {
    if (/\s/.test(source[pos])) {
      pos++;
      continue;
    }
    pattern.lastIndex = pos;
    const match = pattern.exec(source);
    if (!match) throw new Error('Unexpected character "' + source[pos] + '" at position ' + (pos + 1) + '.');
    tokens.push({ text: match[0], pos });
    if (tokens.length > 200) throw new Error('Expression has too many tokens (maximum 200).');
    pos = pattern.lastIndex;
  }
  return tokens;
}

export function parseExpression(source: string): ExpressionNode {
  if (source.trim().length === 0) throw new Error('Enter an expression in x, y, t, a, and b.');
  if (source.length > 600) throw new Error('Expression must be at most 600 characters.');
  const tokens = tokenize(source);
  let cursor = 0;
  let nodes = 0;
  const peek = () => tokens[cursor]?.text;
  const consume = () => tokens[cursor++]?.text;

  function make<T extends ExpressionNode>(node: T): T {
    if (++nodes > 128) throw new Error('Expression is too complex (maximum 128 nodes).');
    return node;
  }

  function parse(minPrecedence = 0, depth = 0): ExpressionNode {
    if (depth > 32) throw new Error('Expression is nested too deeply.');
    const token = consume();
    let left: ExpressionNode;

    if (token === '-' || token === '+') {
      // Unary minus has lower precedence than exponentiation: -x^2 = -(x^2).
      const rhs = parse(3, depth + 1);
      left = token === '-' ? make({ kind: 'unary', op: '-', argument: rhs }) : rhs;
    } else if (token === '(') {
      left = parse(0, depth + 1);
      if (consume() !== ')') throw new Error('Expected closing parenthesis.');
    } else if (token && /^(?:\d|\.)/.test(token)) {
      const n = Number(token);
      if (!Number.isFinite(n)) throw new Error('Invalid finite number "' + token + '".');
      left = make({ kind: 'number', value: n });
    } else if (token === 'pi' || token === 'e') {
      left = make({ kind: 'number', value: token === 'pi' ? Math.PI : Math.E });
    } else if (token && VARIABLES.has(token)) {
      left = make({ kind: 'variable', name: token as 'x' | 'y' | 't' | 'a' | 'b' });
    } else if (token && Object.hasOwn(FUNCTIONS, token)) {
      if (consume() !== '(') throw new Error('Expected "(" after ' + token + '.');
      const args: ExpressionNode[] = [];
      if (peek() !== ')') {
        do {
          args.push(parse(0, depth + 1));
          if (peek() !== ',') break;
          consume();
        } while (true);
      }
      if (consume() !== ')') throw new Error('Expected ")" after ' + token + ' arguments.');
      if (args.length !== FUNCTIONS[token]) {
        throw new Error(token + ' expects ' + FUNCTIONS[token] + ' argument(s), got ' + args.length + '.');
      }
      left = make({ kind: 'call', name: token, args });
    } else {
      throw new Error(token
        ? 'Unexpected symbol "' + token + '" at position ' + (tokens[cursor - 1].pos + 1) + '.'
        : 'Incomplete expression.');
    }

    while (true) {
      const op = peek();
      const precedence = op === '+' || op === '-' ? 1
        : op === '*' || op === '/' ? 2 : op === '^' ? 4 : 0;
      if (!precedence || precedence < minPrecedence) break;
      consume();
      const right = parse(precedence + (op === '^' ? 0 : 1), depth + 1);
      left = make({
        kind: 'binary',
        op: op as '+' | '-' | '*' | '/' | '^',
        left,
        right,
      });
    }
    return left;
  }

  const ast = parse();
  if (cursor !== tokens.length) throw new Error('Unexpected token "' + peek() + '". Use explicit * for multiplication.');
  return ast;
}
