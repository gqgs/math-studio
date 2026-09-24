import {
  StreamLanguage,
  HighlightStyle,
  syntaxHighlighting,
  syntaxTree,
  type StreamParser,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';
import {
  snippetCompletion,
  type Completion,
  type CompletionContext,
} from '@codemirror/autocomplete';
import { SYMBOLS } from './symbols';

const functions = new Set([
  'frac',
  'sqrt',
  'root',
  'mat',
  'vec',
  'cases',
  'binom',
  'abs',
  'norm',
  'sin',
  'cos',
  'tan',
  'ln',
  'log',
  'exp',
  'op',
  'cal',
  'bb',
  'bold',
  'hat',
  'overline',
  'underbrace',
  'lr',
]);
const symbols = new Set([
  ...SYMBOLS.map((item) => item.template.replace(/\{\{.*?\}\}/g, '').split(/[_( ]/)[0]),
  'dif',
  'oo',
  'sum',
  'integral',
  'product',
  'lim',
]);
interface TokenState {
  commentDepth: number;
  string: boolean;
}

// A math-mode highlighter, not a validator. The Typst compiler owns diagnostics.
export const mathParser: StreamParser<TokenState> = {
  name: 'typst-math',
  startState: () => ({ commentDepth: 0, string: false }),
  token(stream, state) {
    if (state.commentDepth || stream.match('/*')) {
      if (!state.commentDepth) state.commentDepth = 1;
      while (!stream.eol()) {
        if (stream.match('/*')) state.commentDepth++;
        else if (stream.match('*/')) {
          if (--state.commentDepth === 0) break;
        } else stream.next();
      }
      return 'comment';
    }
    if (state.string || stream.match('"')) {
      state.string = true;
      while (!stream.eol()) {
        const next = stream.next();
        if (next === '\\') stream.next();
        else if (next === '"') {
          state.string = false;
          break;
        }
      }
      return 'string';
    }
    if (stream.eatSpace()) return null;
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/)) return 'number';
    if (stream.match(/#[A-Za-z][A-Za-z-]*/)) return 'keyword';
    const name = stream.match(/[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*/);
    if (name) {
      const word = (name as RegExpMatchArray)[0];
      if (functions.has(word) || stream.match(/^\s*\(/, false)) return 'function';
      return symbols.has(word) || symbols.has(word.split('.')[0]) ? 'atom' : 'variableName';
    }
    if (stream.match(/[()[\]{}]/)) return 'bracket';
    if (stream.match(/[+\-*/=<>!^_&|:]+/)) return 'operator';
    if (stream.match(/[,$;\\]/)) return 'punctuation';
    stream.next();
    return null;
  },
  tokenTable: { function: tags.function(tags.variableName) },
  languageData: {
    closeBrackets: { brackets: ['(', '[', '{', '"'] },
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
  },
};

export const typstMath = StreamLanguage.define(mathParser);
export const mathHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.function(tags.variableName), class: 'math-function' },
    { tag: tags.atom, class: 'math-symbol' },
    { tag: tags.number, class: 'math-number' },
    { tag: tags.string, class: 'math-string' },
    { tag: tags.comment, class: 'math-comment' },
    { tag: tags.keyword, class: 'math-keyword' },
    { tag: [tags.operator, tags.punctuation], class: 'math-operator' },
    { tag: tags.bracket, class: 'math-bracket' },
    { tag: tags.variableName, color: '#314c38' },
  ]),
);

const snippets: Record<string, string> = {
  frac: 'frac(${a}, ${b})',
  sqrt: 'sqrt(${x})',
  root: 'root(${n}, ${x})',
  mat: 'mat(${a}, ${b}; ${c}, ${d})',
  vec: 'vec(${a}, ${b}, ${c})',
  cases: 'cases(${x} & "if" ${x >= 0}, ${-x} & "otherwise")',
  binom: 'binom(${n}, ${k})',
  sum: 'sum_(${i=1})^${n} ${i}',
  product: 'product_(${i=1})^${n} ${i}',
  integral: 'integral_${a}^${b} ${f(x)} dif x',
  limit: 'lim_(${x -> 0}) ${f(x)}',
  derivative: 'frac(dif ${f}, dif ${x})',
};

export const mathCompletions: Completion[] = SYMBOLS.map((item) => {
  const text = item.template.replace(/\{\{(.*?)\}\}/g, '$1');
  const template = snippets[item.id];
  const completion: Completion = {
    label: item.id,
    displayLabel: `${item.id}  ${item.glyph}`,
    detail: item.name,
    type: template ? 'function' : 'constant',
    apply: text,
    info: `Typst: ${text}`,
  };
  return template ? snippetCompletion(template, completion) : completion;
});
for (const name of functions) {
  if (!mathCompletions.some((item) => item.label === name)) {
    mathCompletions.push(
      snippetCompletion(`${name}(\${x})`, {
        label: name,
        type: 'function',
        detail: 'Math function',
      }),
    );
  }
}

export function completeMath(context: CompletionContext) {
  const node = syntaxTree(context.state).resolveInner(context.pos, -1);
  if (/comment|string/i.test(node.name)) return null;
  const word = context.matchBefore(/[A-Za-z][A-Za-z0-9.-]*/);
  if (!word && !context.explicit) return null;
  return {
    from: word?.from ?? context.pos,
    options: mathCompletions,
    validFor: /^[A-Za-z][A-Za-z0-9.-]*$/,
  };
}
