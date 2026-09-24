import { expect, it } from 'vitest';
import { EditHistory } from './history';

it('groups typing and treats symbol insertions as separate undoable edits', () => {
  const history = new EditHistory('');
  history.commit({ text: 'a', start: 1, end: 1 }, true, 1000);
  history.commit({ text: 'ab', start: 2, end: 2 }, true, 1100);
  history.selection(0, 2);
  history.commit({ text: 'sqrt(ab)', start: 8, end: 8 });
  expect(history.undo()).toEqual({ text: 'ab', start: 0, end: 2 });
  expect(history.undo().text).toBe('');
  expect(history.redo().text).toBe('ab');
  expect(history.redo().text).toBe('sqrt(ab)');
});

it('clears redo after a new edit and restores cleared text', () => {
  const history = new EditHistory('x^2');
  history.commit({ text: '', start: 0, end: 0 });
  expect(history.undo().text).toBe('x^2');
  history.commit({ text: 'x^3', start: 3, end: 3 });
  expect(history.canRedo).toBe(false);
  expect(history.undo().text).toBe('x^2');
});
