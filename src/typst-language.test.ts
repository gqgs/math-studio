import { expect, it } from 'vitest';
import { EditorState, type Transaction } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import { completeMath, mathCompletions, typstMath } from './typst-language';

it('highlights math without requiring dollar delimiters', () => {
  const state = EditorState.create({ doc: 'sqrt(2) + alpha', extensions: [typstMath] });
  const names: string[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      names.push(node.name);
    },
  });
  expect(names).toEqual(expect.arrayContaining(['function', 'number', 'atom']));
});

it.each(['// alp', '"alp', '/* outer /* nested */ alp'])(
  'does not suggest math inside %s',
  (doc) => {
    const state = EditorState.create({ doc, extensions: [typstMath] });
    expect(completeMath(new CompletionContext(state, doc.length, true))).toBeNull();
  },
);

it('inserts a fraction snippet with a selected numerator and intact newlines', () => {
  let state = EditorState.create({ doc: 'x\ny\n\nfra', extensions: [typstMath] });
  const completion = mathCompletions.find((item) => item.label === 'frac')!;
  const apply = completion.apply;
  expect(typeof apply).toBe('function');
  if (typeof apply !== 'function') throw new Error('Missing snippet');
  apply(
    {
      state,
      dispatch: (transaction: Transaction) => {
        state = transaction.state;
      },
    } as Parameters<typeof apply>[0],
    completion,
    5,
    8,
  );
  expect(state.doc.toString()).toBe('x\ny\n\nfrac(a, b)');
  expect(state.sliceDoc(state.selection.main.from, state.selection.main.to)).toBe('a');
});
