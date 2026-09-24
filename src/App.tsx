import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Code2,
  Copy,
  FilePlus2,
  LockKeyhole,
  Maximize2,
  Minus,
  Plus,
  Redo2,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  X,
  AlertCircle,
  RotateCcw,
  LoaderCircle,
} from 'lucide-react';
import {
  diagnosticLine,
  EXAMPLES,
  INITIAL_SOURCE,
  insertSymbol,
  type Edit,
  type FormulaBlock,
  type MathSymbol,
} from './math';
import { CATEGORIES, QUICK_SYMBOLS, SYMBOLS } from './symbols';
import { MathEditor, type MathEditorHandle, type EditorSnapshot } from './MathEditor';
import { useRenderer } from './use-renderer';

const DRAFT_KEY = 'math-studio:draft:v1';

function readDraft() {
  try {
    return { text: localStorage.getItem(DRAFT_KEY) ?? INITIAL_SOURCE, failed: false };
  } catch {
    return { text: INITIAL_SOURCE, failed: true };
  }
}

function FormulaImage({ svg, source, zoom }: { svg: string; source: string; zoom: number }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [svg]);
  const width = Number(/\bwidth="([\d.]+)"/.exec(svg)?.[1] ?? 300);
  return url ? (
    <img
      className="formula-image"
      src={url}
      alt={`Formula: ${source}`}
      style={{ width: width * zoom }}
    />
  ) : null;
}

export default function App() {
  const [initial] = useState(readDraft);
  const [source, setSource] = useState(initial.text);
  const editor = useRef<MathEditorHandle>(null);
  const sourceRef = useRef(initial.text);
  const [editorState, setEditorState] = useState<EditorSnapshot>({
    text: initial.text,
    start: 0,
    end: 0,
    canUndo: false,
    canRedo: false,
  });
  const previewPaper = useRef<HTMLDivElement>(null);
  const [symbolsOpen, setSymbolsOpen] = useState(
    () => window.matchMedia('(min-width: 801px) and (min-height: 701px)').matches,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const [modal, setModal] = useState<'examples' | 'guide' | null>(null);
  const [category, setCategory] = useState('Greek');
  const [search, setSearch] = useState('');
  const [composing, setComposing] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>(
    initial.failed ? 'failed' : 'saved',
  );
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [zoom, setZoom] = useState(1);
  const renderer = useRenderer(source, composing);
  const editorDiagnostics = useMemo(
    () =>
      renderer.blocks.flatMap((block) =>
        (renderer.results.get(block.source)?.diagnostics ?? []).map((diagnostic) => ({
          line: diagnosticLine(diagnostic.range, block),
          message: diagnostic.message,
        })),
      ),
    [renderer.blocks, renderer.results],
  );
  const activeBlock = renderer.blocks.find((block) => cursor >= block.start && cursor <= block.end);
  const readyCount = renderer.blocks.filter(
    (block) => renderer.results.get(block.source)?.svg,
  ).length;
  const hasErrors = renderer.blocks.some(
    (block) => renderer.results.get(block.source)?.diagnostics.length,
  );
  const pending = renderer.blocks.some((block) => !renderer.results.has(block.source));
  const activeSvg = activeBlock && renderer.results.get(activeBlock.source)?.svg;

  // Follow editing within the preview's own scroll area, without scrolling the page.
  useEffect(() => {
    const paper = previewPaper.current;
    if (!paper || !activeBlock) return;
    const card = paper.querySelector<HTMLElement>(`[data-block-id="${activeBlock.id}"]`);
    if (!card) return;
    const reveal = () => {
      const viewport = paper.getBoundingClientRect();
      const bounds = card.getBoundingClientRect();
      let top = bounds.top;
      let bottom = bounds.bottom;
      if (bounds.height > paper.clientHeight - 24) {
        const image = card.querySelector('img');
        const content = image?.getBoundingClientRect() ?? bounds;
        const lineCount = activeBlock.source.split('\n').length;
        const sourceLine = source.slice(0, cursor).split('\n').length;
        const lineIndex = Math.max(
          0,
          Math.min(lineCount - 1, sourceLine - activeBlock.contentStartLine),
        );
        const y = content.top + (content.height * (lineIndex + 0.5)) / lineCount;
        top = y - 28;
        bottom = y + 28;
      }
      if (top < viewport.top + 12) paper.scrollTop += top - viewport.top - 12;
      else if (bottom > viewport.bottom - 12) paper.scrollTop += bottom - viewport.bottom + 12;
    };
    const observer = new ResizeObserver(reveal);
    observer.observe(card);
    reveal();
    return () => observer.disconnect();
  }, [activeBlock?.id, activeBlock?.source, activeSvg, cursor, source, zoom]);
  const shownSymbols = SYMBOLS.filter((item) => {
    if (search.trim())
      return `${item.name} ${item.id} ${item.glyph} ${item.template} ${item.keywords}`
        .toLowerCase()
        .includes(search.toLowerCase().trim());
    return category === 'All' || item.category === category;
  });

  useEffect(() => {
    setSaveState('saving');
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, source);
        setSaveState('saved');
      } catch {
        setSaveState('failed');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [source]);

  // Flush the latest text when a tab is hidden or closed, including during debounce.
  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(DRAFT_KEY, sourceRef.current);
      } catch {
        /* The UI already reports storage failure. */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (modal && !dialog.current?.open) dialog.current?.showModal();
    if (!modal && dialog.current?.open) dialog.current?.close();
  }, [modal]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function notify(message: string) {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }

  function commit(edit: Edit) {
    editor.current?.apply(edit);
  }

  function restore(direction: 'undo' | 'redo') {
    editor.current?.[direction]();
  }

  function insert(item: MathSymbol) {
    const selection = editor.current?.snapshot() ?? editorState;
    commit(insertSymbol(selection.text, selection.start, selection.end, item));
  }

  function insertExample(example: string) {
    const position = (editor.current?.snapshot() ?? editorState).start;
    const block = renderer.blocks.find((item) => position >= item.start && position <= item.end);
    const at = block ? block.end : position;
    const before = source.slice(0, at).trimEnd();
    const after = source.slice(at).trimStart();
    const start = before.length + (before ? 2 : 0);
    const text = `${before}${before ? '\n\n' : ''}${example}${after ? '\n\n' + after : ''}`;
    setModal(null);
    requestAnimationFrame(() =>
      commit({ text, start: start + example.length, end: start + example.length }),
    );
    notify('Example inserted');
  }

  async function copySource() {
    try {
      await navigator.clipboard.writeText(source);
      notify('Source copied to clipboard');
    } catch {
      editor.current?.select(0, source.length);
      notify('Source selected. Press Ctrl+C or ⌘C to copy.');
    }
  }

  function jumpToBlock(block: FormulaBlock, line?: number) {
    let start = block.start;
    if (line)
      start = source
        .split('\n')
        .slice(0, line - 1)
        .reduce((sum, value) => sum + value.length + 1, 0);
    const end = line
      ? Math.min(
          source.length,
          source.indexOf('\n', start) === -1 ? source.length : source.indexOf('\n', start),
        )
      : block.end;
    editor.current?.select(start, end);
  }

  return (
    <>
      <header className="site-header">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Math Studio home">
          <span className="brand-mark">∑</span>
          <span>
            math<span className="brand-light">studio</span>
            <span className="brand-dot">.</span>
          </span>
        </a>
        <div className="header-right">
          <span className="header-caption">A little space for big ideas</span>
          <span className="header-divider" />
          <button className="text-button guide-button" onClick={() => setModal('guide')}>
            <BookOpen size={16} /> Syntax guide <ArrowRight size={14} />
          </button>
        </div>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <div>
            <div className="eyebrow">
              <span /> THINK IT. TYPE IT. SEE IT.
            </div>
            <h1 id="page-title">
              Make room for <em>math.</em>
            </h1>
            <p>From a simple fraction to your next big idea. Just start typing.</p>
          </div>
          <button className="examples-button" onClick={() => setModal('examples')}>
            <Sparkles size={16} />
            <span>Start with an example</span>
            <ChevronDown size={15} />
          </button>
        </section>

        <div className="workspace">
          <section className="editor-panel panel" aria-labelledby="editor-title">
            <div className="panel-heading">
              <h2 id="editor-title">
                <Code2 size={17} /> Your formulas
              </h2>
              <span className="language-tag">Typst math</span>
            </div>
            <div className="editor-toolbar">
              <div className="toolbar-group">
                <button
                  className="icon-button"
                  title="Undo (Ctrl/⌘ Z)"
                  aria-label="Undo"
                  disabled={!editorState.canUndo}
                  onClick={() => restore('undo')}
                >
                  <Undo2 size={16} />
                </button>
                <button
                  className="icon-button"
                  title="Redo (Ctrl/⌘ Shift Z)"
                  aria-label="Redo"
                  disabled={!editorState.canRedo}
                  onClick={() => restore('redo')}
                >
                  <Redo2 size={16} />
                </button>
                <span className="toolbar-separator" />
                <span className="toolbar-caption">New line ↵ · New cell ↵↵</span>
              </div>
              <div className="toolbar-group">
                <button
                  className="icon-button"
                  title="Copy all source"
                  aria-label="Copy all source"
                  disabled={!source}
                  onClick={copySource}
                >
                  <Copy size={15} />
                </button>
                <button
                  className="icon-button"
                  title="Clear formulas"
                  aria-label="Clear formulas"
                  disabled={!source}
                  onClick={() => {
                    commit({ text: '', start: 0, end: 0 });
                    notify('Cleared. You can undo this.');
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <div className="source-editor">
              <MathEditor
                ref={editor}
                initialSource={initial.text}
                onChange={(snapshot) => {
                  sourceRef.current = snapshot.text;
                  setSource(snapshot.text);
                  setCursor(snapshot.start);
                  setEditorState(snapshot);
                }}
                onCompositionChange={setComposing}
                diagnostics={editorDiagnostics}
              />
            </div>
            <div className="editor-meta">
              <span id="editor-hint">
                <span className="hint-symbol">↵</span> Enter for a new line · Blank line for a new
                cell
              </span>
              <span>{source.length} characters</span>
            </div>

            <details
              className="symbols-panel"
              open={symbolsOpen}
              onToggle={(event) => setSymbolsOpen(event.currentTarget.open)}
            >
              <summary className="symbols-heading">
                <h3>At your fingertips</h3>
                <span>
                  Math symbols <ChevronDown size={13} />
                </span>
              </summary>
              <div className="quick-symbols" aria-label="Common symbols">
                {QUICK_SYMBOLS.map((item) => (
                  <button
                    key={item.id}
                    className="quick-symbol"
                    onClick={() => insert(item)}
                    title={`${item.name} · ${item.template.replaceAll(/\{\{|\}\}/g, '')}`}
                    aria-label={`Insert ${item.name}`}
                  >
                    <span>{item.glyph}</span>
                  </button>
                ))}
              </div>
              <div className="palette-search">
                <Search size={15} />
                <input
                  aria-label="Search symbols"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find a symbol…"
                />
                {search ? (
                  <button
                    className="icon-button"
                    aria-label="Clear symbol search"
                    onClick={() => setSearch('')}
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <span className="search-hint">α → ∞</span>
                )}
              </div>
              <div className="category-tabs" aria-label="Symbol categories">
                {CATEGORIES.map((item) => (
                  <button
                    key={item}
                    aria-pressed={category === item && !search}
                    className={category === item && !search ? 'selected' : ''}
                    onClick={() => {
                      setCategory(item);
                      setSearch('');
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="symbol-grid" aria-label="Symbol palette">
                {shownSymbols.map((item) => (
                  <button
                    className="symbol-button"
                    key={item.id}
                    onClick={() => insert(item)}
                    aria-label={`Insert ${item.name}`}
                    title={`${item.name} · ${item.template.replaceAll(/\{\{|\}\}/g, '')}`}
                  >
                    <span className="symbol-glyph">{item.glyph}</span>
                    <span className="symbol-name">{item.name}</span>
                  </button>
                ))}
                {!shownSymbols.length && (
                  <div className="no-symbols">
                    No symbols found. Try “root”, “alpha”, or “integral”.
                  </div>
                )}
              </div>
            </details>
          </section>

          <section className="preview-panel panel" aria-labelledby="preview-title">
            <div className="panel-heading">
              <h2 id="preview-title">
                <span className="preview-icon">ƒ</span> Live preview
              </h2>
              <span className={`live-badge ${hasErrors ? 'has-errors' : ''}`}>
                <span />
                {renderer.state === 'loading'
                  ? 'Warming up'
                  : renderer.state === 'error'
                    ? 'Paused'
                    : pending
                      ? 'Updating'
                      : 'Live'}
              </span>
            </div>
            <div className="preview-toolbar">
              <span>
                {renderer.blocks.length} {renderer.blocks.length === 1 ? 'cell' : 'cells'}
                <span className="preview-toolbar-detail"> · Beautifully typeset</span>
              </span>
              <div className="zoom-controls">
                <button
                  className="icon-button"
                  aria-label="Zoom out"
                  title="Zoom out"
                  disabled={zoom <= 0.6}
                  onClick={() => setZoom((value) => Math.max(0.6, +(value - 0.1).toFixed(1)))}
                >
                  <Minus size={14} />
                </button>
                <button
                  className="zoom-value"
                  onClick={() => setZoom(1)}
                  title="Reset zoom"
                  aria-label="Reset zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  className="icon-button"
                  aria-label="Zoom in"
                  title="Zoom in"
                  disabled={zoom >= 1.8}
                  onClick={() => setZoom((value) => Math.min(1.8, +(value + 0.1).toFixed(1)))}
                >
                  <Plus size={14} />
                </button>
                <span className="toolbar-separator" />
                <button
                  className="icon-button"
                  title="Reset zoom"
                  aria-label="Reset preview size"
                  onClick={() => setZoom(1)}
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>
            <div
              className="preview-paper"
              ref={previewPaper}
              tabIndex={0}
              role="region"
              aria-label="Rendered formulas"
            >
              {renderer.state === 'error' && (
                <div className="renderer-message" role="alert">
                  <AlertCircle size={20} />
                  <p>{renderer.error}</p>
                  <button className="small-button" onClick={renderer.retry}>
                    <RotateCcw size={14} /> Retry renderer
                  </button>
                </div>
              )}
              {renderer.state === 'loading' && (
                <div className="loading-message" role="status">
                  <LoaderCircle className="spin" size={17} />
                  <span>
                    Getting your math ready
                    <span className="loading-detail">
                      Loading the renderer once. Your typing stays right here.
                    </span>
                  </span>
                </div>
              )}
              {!renderer.blocks.length && (
                <div className="empty-preview">
                  <span className="empty-formula">ƒ(x)</span>
                  <h3>Every idea starts somewhere.</h3>
                  <p>
                    Write a formula on the left, or pick an example.
                    <br />
                    We’ll take care of the beautiful part.
                  </p>
                  <button className="small-button" onClick={() => setModal('examples')}>
                    <FilePlus2 size={15} /> Explore examples
                  </button>
                </div>
              )}
              <div className="formula-list">
                {renderer.blocks.map((block) => {
                  const result = renderer.results.get(block.source);
                  const problem = result?.diagnostics[0];
                  return (
                    <article
                      className={`formula-card ${activeBlock?.id === block.id ? 'active' : ''} ${problem ? 'formula-error' : ''}`}
                      key={block.id}
                      data-testid="formula-card"
                      data-block-id={block.id}
                    >
                      <div className="formula-card-top">
                        <span className="formula-number">
                          {String(block.id + 1).padStart(2, '0')}
                        </span>
                        <button
                          className="edit-formula"
                          onClick={() => jumpToBlock(block)}
                          aria-label={`Edit formula ${block.id + 1}`}
                          title="Select source"
                        >
                          Edit source <ArrowDownLeft size={12} />
                        </button>
                      </div>
                      {result?.svg ? (
                        <div className="formula-scroll">
                          <FormulaImage svg={result.svg} source={block.source} zoom={zoom} />
                        </div>
                      ) : problem ? (
                        <div className="formula-diagnostic">
                          <AlertCircle size={17} />
                          <div>
                            <p>{problem.message}</p>
                            <button
                              onClick={() =>
                                jumpToBlock(block, diagnosticLine(problem.range, block))
                              }
                            >
                              Check line {diagnosticLine(problem.range, block)}{' '}
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="formula-placeholder">
                          <span />
                          <span />
                          <span />
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              {!!renderer.blocks.length && !pending && !hasErrors && renderer.state !== 'error' && (
                <div className="preview-end">
                  <span />
                  <span className="end-diamond">◇</span>
                  <span />
                </div>
              )}
            </div>
            <div className="preview-footer">
              <span className={`render-status ${hasErrors ? 'warning' : ''}`}>
                {hasErrors ? <AlertCircle size={13} /> : <Check size={14} />}
                {renderer.state === 'error'
                  ? 'Preview unavailable'
                  : renderer.state === 'loading'
                    ? 'Preparing preview'
                    : pending
                      ? 'Rendering your formulas…'
                      : hasErrors
                        ? 'Check the highlighted formulas'
                        : readyCount
                          ? 'All formulas rendered'
                          : 'Ready when you are'}
              </span>
              <span>Updates as you type</span>
            </div>
          </section>
        </div>

        <div className="below-workspace">
          <div className="friendly-tip">
            <span className="tip-icon">
              <CircleHelp size={15} />
            </span>
            <p>
              A small tip: <code>sqrt(x)</code> makes a square root. <code>x^2</code> adds a power.
              <button onClick={() => setModal('guide')}>
                More shortcuts <ArrowRight size={13} />
              </button>
            </p>
          </div>
          <div className={`save-status ${saveState === 'failed' ? 'warning' : ''}`}>
            {saveState === 'failed' ? <AlertCircle size={13} /> : <Check size={13} />}
            <span>
              {saveState === 'saved'
                ? 'Draft saved in this browser'
                : saveState === 'saving'
                  ? 'Saving draft…'
                  : 'Draft could not be saved — copy it to keep it'}
            </span>
          </div>
        </div>
      </main>

      <footer className="site-footer">
        <span>Made for the way you think.</span>
        <span>
          <LockKeyhole size={12} /> Your formulas stay in your browser.
        </span>
      </footer>

      <dialog
        ref={dialog}
        className="app-dialog"
        onCancel={() => setModal(null)}
        onClose={() => setModal(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              setModal(null);
          }
        }}
        aria-labelledby="dialog-title"
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">
              {modal === 'examples' ? 'A PLACE TO BEGIN' : 'A LITTLE REFERENCE'}
            </span>
            <h2 id="dialog-title">
              {modal === 'examples' ? 'Borrow a little inspiration.' : 'Math, in your own words.'}
            </h2>
          </div>
          <button className="icon-button" aria-label="Close dialog" onClick={() => setModal(null)}>
            <X size={20} />
          </button>
        </div>
        {modal === 'examples' ? (
          <>
            <p className="dialog-intro">
              Choose a formula to insert after the one you’re working on.
            </p>
            <div className="example-list">
              {EXAMPLES.map((example) => (
                <button
                  key={example.name}
                  className="example-item"
                  onClick={() => insertExample(example.source)}
                >
                  <div>
                    <strong>{example.name}</strong>
                    <span>{example.description}</span>
                    <code>{example.source}</code>
                  </div>
                  <Plus size={18} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="dialog-intro">
              Write Typst math directly. Dollar signs are optional. Press Enter for a new line
              within a cell. Leave a blank line to start a new cell.
            </p>
            <div className="guide-table">
              <div>
                <span>What you need</span>
                <span>What to type</span>
              </div>
              {[
                ['Powers & subscripts', 'x^2 + a_n'],
                ['Fractions', '(a + b) / c'],
                ['Square roots', 'sqrt(x + 1)'],
                ['Greek letters', 'alpha + beta = pi'],
                ['Sums', 'sum_(i=1)^n i'],
                ['Integrals', 'integral_0^1 x dif x'],
                ['Matrices', 'mat(a, b; c, d)'],
                ['Text in formulas', 'x > 0 "for all" x in RR'],
                ['Aligned lines', 'a &= b \\ c &= d'],
              ].map(([name, syntax]) => (
                <div key={name}>
                  <span>{name}</span>
                  <code>{syntax}</code>
                </div>
              ))}
            </div>
            <p className="guide-note">
              Single newlines appear as line breaks in the same cell. Two newlines start a new cell.
              Use <code>&amp;</code> to align equations across lines; explicit <code>\</code> breaks
              also work. Symbol buttons insert at your cursor; select text first to wrap it in a
              root or fraction.
            </p>
            <div className="guide-table shortcut-table" aria-label="Editor shortcuts">
              <div>
                <span>Editor shortcuts</span>
                <span>Keys</span>
              </div>
              {[
                ['Suggestions', 'Ctrl + Space'],
                ['Accept / next field', 'Tab'],
                ['Previous field', 'Shift + Tab'],
                ['New line / new cell', 'Enter / Enter twice'],
                ['Undo / redo', 'Ctrl/⌘ Z / Ctrl/⌘ Shift Z'],
                ['Find / replace', 'Ctrl/⌘ F / Ctrl/⌘ Alt F'],
                ['Move line', 'Alt + ↑ / ↓'],
                ['Dismiss suggestions', 'Escape'],
              ].map(([action, keys]) => (
                <div key={action}>
                  <span>{action}</span>
                  <code>{keys}</code>
                </div>
              ))}
            </div>
            <p className="guide-note">
              Enter always inserts a newline, even when suggestions are open. Tab moves to the next
              control when no suggestion or snippet field is active. Compiler errors are underlined
              on their source line.
            </p>
            <a
              className="documentation-link"
              href="https://typst.app/docs/reference/math/"
              target="_blank"
              rel="noreferrer"
            >
              Explore the Typst math reference <ArrowRight size={15} />
            </a>
          </>
        )}
      </dialog>
      <div className={`toast ${toast ? 'visible' : ''}`} role="status">
        {toast && (
          <>
            <Check size={16} />
            {toast}
          </>
        )}
      </div>
    </>
  );
}
