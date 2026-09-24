import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { EditorState, Prec, Transaction } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  rectangularSelection,
  highlightSpecialChars,
  placeholder,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  undo,
  redo,
  undoDepth,
  redoDepth,
  isolateHistory,
  insertNewline,
} from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
  acceptCompletion,
  closeCompletion,
  nextSnippetField,
  prevSnippetField,
} from '@codemirror/autocomplete';
import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintGutter, lintKeymap, setDiagnostics } from '@codemirror/lint';
import { completeMath, mathHighlighting, typstMath } from './typst-language';
import type { Edit } from './math';

export interface EditorSnapshot extends Edit {
  canUndo: boolean;
  canRedo: boolean;
}
export interface EditorDiagnostic {
  line: number;
  message: string;
}
export interface MathEditorHandle {
  snapshot(): EditorSnapshot;
  apply(edit: Edit): void;
  select(start: number, end: number): void;
  undo(): void;
  redo(): void;
}
interface Props {
  initialSource: string;
  onChange(snapshot: EditorSnapshot): void;
  onCompositionChange(composing: boolean): void;
  diagnostics: EditorDiagnostic[];
}

function snapshot(view: EditorView): EditorSnapshot {
  const range = view.state.selection.main;
  return {
    text: view.state.doc.toString(),
    start: range.from,
    end: range.to,
    canUndo: undoDepth(view.state) > 0,
    canRedo: redoDepth(view.state) > 0,
  };
}

export const MathEditor = forwardRef<MathEditorHandle, Props>(function MathEditor(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useImperativeHandle(
    ref,
    () => ({
      snapshot: () => snapshot(editor.current!),
      apply(edit) {
        const view = editor.current!;
        const previous = view.state.doc.toString();
        let from = 0;
        while (
          from < previous.length &&
          from < edit.text.length &&
          previous[from] === edit.text[from]
        )
          from++;
        let oldEnd = previous.length,
          newEnd = edit.text.length;
        while (oldEnd > from && newEnd > from && previous[oldEnd - 1] === edit.text[newEnd - 1]) {
          oldEnd--;
          newEnd--;
        }
        view.dispatch({
          changes: { from, to: oldEnd, insert: edit.text.slice(from, newEnd) },
          selection: { anchor: edit.start, head: edit.end },
          annotations: [isolateHistory.of('full'), Transaction.userEvent.of('input.palette')],
          scrollIntoView: true,
        });
        view.focus();
      },
      select(start, end) {
        const view = editor.current!;
        view.dispatch({ selection: { anchor: start, head: end }, scrollIntoView: true });
        view.focus();
      },
      undo() {
        const view = editor.current!;
        undo(view);
        view.focus();
      },
      redo() {
        const view = editor.current!;
        redo(view);
        view.focus();
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: latest.current.initialSource,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          rectangularSelection(),
          highlightSpecialChars(),
          history(),
          EditorState.allowMultipleSelections.of(true),
          typstMath,
          mathHighlighting,
          bracketMatching(),
          closeBrackets(),
          autocompletion({ override: [completeMath], defaultKeymap: false, interactionDelay: 0 }),
          search({ top: true }),
          highlightSelectionMatches(),
          lintGutter(),
          Prec.highest(
            keymap.of([
              // Enter always means a literal newline, even when suggestions are open.
              {
                key: 'Enter',
                run: (editor) => {
                  closeCompletion(editor);
                  return insertNewline(editor);
                },
              },
              { key: 'Tab', run: nextSnippetField },
              { key: 'Tab', run: acceptCompletion },
              { key: 'Shift-Tab', run: prevSnippetField },
            ]),
          ),
          keymap.of([
            ...completionKeymap.filter((binding) => binding.key !== 'Enter'),
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            ...lintKeymap,
          ]),
          EditorView.contentAttributes.of({
            'aria-label': 'Math formulas',
            'aria-describedby': 'editor-hint',
            'aria-multiline': 'true',
            spellcheck: 'false',
            autocapitalize: 'off',
            autocorrect: 'off',
          }),
          placeholder('x^2 + y^2 = r^2\nYour next idea goes here…'),
          EditorView.domEventHandlers({
            compositionstart() {
              latest.current.onCompositionChange(true);
            },
            compositionend() {
              latest.current.onCompositionChange(false);
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged || update.selectionSet)
              latest.current.onChange(snapshot(update.view));
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: '13px', color: '#314c38', backgroundColor: '#fff' },
            '&.cm-focused': { outline: 'none' },
            '.cm-scroller': {
              overflow: 'auto',
              fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
              lineHeight: '28px',
              overscrollBehavior: 'contain',
            },
            '.cm-content': { padding: '12px 0', caretColor: '#285d49' },
            '.cm-line': { padding: '0 12px' },
            '.cm-gutters': {
              backgroundColor: '#fdfdfa',
              color: '#656861',
              borderRight: '1px solid #f0f1eb',
            },
            '.cm-lineNumbers .cm-gutterElement': { minWidth: '28px', padding: '0 6px' },
            '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: '#f2f6ec' },
            '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
              backgroundColor: '#dbe9d2',
            },
            '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#285d49' },
            '.cm-matchingBracket': { backgroundColor: '#dbe9d2', outline: '1px solid #97b08b' },
            '.cm-tooltip': {
              border: '1px solid #b6c5aa',
              backgroundColor: '#fcfdf9',
              color: '#344530',
              fontSize: '12px',
            },
            '.cm-tooltip-autocomplete ul li[aria-selected]': {
              backgroundColor: '#285d49',
              color: '#fff',
            },
            '.cm-completionDetail': { color: 'inherit', opacity: '1', fontStyle: 'normal' },
            '.cm-panels': { backgroundColor: '#f3f6ee', color: '#344530' },
            '.cm-textfield, .cm-button': {
              background: '#fff',
              color: '#344530',
              border: '1px solid #bdc9b5',
              borderRadius: '3px',
            },
            '.cm-placeholder': { color: '#626860' },
            '.cm-tooltip-lint': { maxWidth: '320px' },
            '@media (max-width: 800px)': { '&': { fontSize: '16px' } },
          }),
        ],
      }),
    });
    editor.current = view;
    latest.current.onChange(snapshot(view));
    return () => {
      view.destroy();
      editor.current = null;
    };
  }, []);

  useEffect(() => {
    const view = editor.current;
    if (!view) return;
    const diagnostics = props.diagnostics.map((item) => {
      const line = view.state.doc.line(Math.max(1, Math.min(item.line, view.state.doc.lines)));
      return {
        from: line.from,
        to: line.to,
        severity: 'error' as const,
        message: item.message,
        source: 'Typst',
      };
    });
    view.dispatch(setDiagnostics(view.state, diagnostics));
  }, [props.diagnostics]);

  return <div className="math-editor" ref={host} />;
});
