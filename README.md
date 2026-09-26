# Math Studio

A light, responsive math scratchpad with a CodeMirror 6 editor and a real Typst preview. Formulas are compiled in a browser worker; draft text never leaves the browser.

<p align="center">
<img src="/image.png">
</p>

## Run locally

Requires Node.js 22.12+ (or Node.js 24+) and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To serve the production build:

```sh
npm run build
npm run preview
```

## Writing math

- Write raw Typst math, for example `x^2 + y^2 = r^2`. A single enclosing `$…$` pair is also accepted.
- A single newline creates a visible line break inside the same preview cell. A blank line (two newlines) starts a new cell; whitespace-only blank lines work too.
- Use `&` to align equations across lines in a cell. Explicit Typst `\` breaks also work; combining one with an input newline does not add an extra break.
- Symbol buttons insert at the editor’s last selection. Roots, fractions, powers, and other structures can wrap selected text.
- Undo/redo includes typing, symbol insertion, examples, and clearing. Use the toolbar, Ctrl/⌘ Z, or Ctrl/⌘ Shift Z.
- Examples insert after the current formula. Copy source copies the whole scratchpad.
- One draft is saved to this browser’s local storage, including an empty draft. Clearing browser storage removes it. There are no accounts, uploads, analytics, or cloud sync.

The workspace fits the viewport. The editor and preview scroll independently, and the preview follows the cell being edited (or the approximate current line in a tall cell). The symbol palette can collapse; it starts collapsed on phones and short screens to leave room for editing.

## Plotting formulas

Choose **Plot formulas** to graph up to six expressions in `x`. Try `sin(x)`, `x^2`, or `cos(x) * exp(-x^2 / 10)`. Curves update as you type, with individual errors for invalid expressions. Adjust the x/y limits, zoom in or out, or reset the range.

The plot uses numeric syntax: `+`, `-`, `*`, `/`, `^`, parentheses, `pi`, `e`, and the functions listed in the view. Optional `y =` prefixes are accepted. Multiplication needs `*`; trigonometric functions use radians, `ln` is natural logarithm, and `log` is base 10. Typst layout expressions are not evaluated by the plotter. All evaluation is local through a math-only parser.

Plots are sampled approximations; very narrow features may be missed. Undefined values and detected discontinuities break the curve. Plot formulas and ranges survive switching views, but reset on reload; the writing draft retains its existing autosave behavior.

## Editor

CodeMirror 6 provides undo history, selections, line numbers, bracket matching/closing, search/replace, and editing commands. A small math-mode tokenizer highlights raw Typst math directly; it is not a complete Typst parser. The existing compiler supplies line-level inline errors, so diagnostics match the bundled Typst version.

- **Enter** always inserts a literal newline, including when autocomplete is open. **Enter twice** creates a new cell. No automatic indentation or completion rewrites these boundaries.
- **Ctrl+Space** opens math suggestions. **Tab** accepts a suggestion or moves through snippet fields; **Shift+Tab** moves backward. Outside an active suggestion/snippet, Tab moves focus normally.
- Fraction, matrix, root, integral, and other completion snippets provide editable placeholders. Completions insert Typst source, not Unicode replacements.
- **Ctrl/⌘ F** opens search; **Ctrl/⌘ Alt F** opens replace. **Alt+↑/↓** moves lines; **Ctrl+Shift+Alt+↑/↓** duplicates them. **Ctrl/⌘ Z** and **Ctrl/⌘ Shift Z** undo and redo, including toolbar edits.
- The syntax guide in the app includes these shortcuts. Rendered cells, draft storage, and newline transformation continue to use the same plain-text source.

## Rendering and compatibility

The compiler, renderer, and wrapper are pinned to **typst.ts 0.7.0**, which bundles **Typst 0.14.2** ([release dependency metadata](https://github.com/Myriad-Dreamin/typst.ts/blob/v0.7.0/Cargo.lock)). Built-in math follows that version; newer examples from the online Typst reference may use features it does not contain.

The editor uses a 150 ms debounce and pauses compilation during IME composition. Each cell is compiled independently, with source newlines converted to visible math line breaks. Results are cached by source, so reordering formulas does not require recompilation. Only the newest document’s pending work is queued. Source diagnostics account for the generated wrapper and point back to the editor.

The worker has a 30-second initialization deadline and a five-second deadline per formula. An overlong formula terminates its worker, receives a diagnostic, and the remaining formulas continue in a new worker. Initialization failures offer a retry button. SVGs are displayed as isolated blob images rather than injected into the page.

This is a math scratchpad, not a full Typst document editor. External packages, uploaded files, custom fonts, cross-formula definitions, image exports, and named collections are outside this version. The source is exposed as an image alternative; automated spoken-math conversion is not included.

## Deployment

Serve `dist/` using any static host. All WASM modules and fonts are included locally; no CDN or external font requests are needed at runtime. Serve `.wasm` as `application/wasm`, enable gzip/Brotli, and cache hashed assets. The compiler is approximately 28 MB before compression (11 MB with gzip), so the first preview has a loading state while the editor remains usable.

For a subdirectory deployment, build with `npm run build -- --base=/math-studio/`. There is no service worker; a fresh page load still requires access to the static host.

## Verification

```sh
npm test
npm run build
npm run test:e2e
```

Browser tests use Chromium at `/usr/bin/chromium`. Set `CHROMIUM_PATH` to another Chromium executable if needed. Playwright starts a production preview server automatically on port 4173.

Tests cover every built-in symbol template and example, actual WASM rendering, independent errors, cursor insertion, undo/redo, autosave, empty draft restoration, IME composition, rapid edits, mobile overflow, zoom, dialogs, loading failure recovery, storage failures, and automated WCAG AA accessibility checks. Unit tests cover parsing, source mapping, edits, caching, stale results, and worker timeout recovery. Desktop and mobile screenshots are written to `test-results/`.

Current Chrome, Firefox, and Safari are the intended browser targets; automated browser verification runs in Chromium.

## Fonts

New Computer Modern Math and New Computer Modern text fonts are bundled unmodified from [typst-assets v0.13.1](https://github.com/typst/typst-assets/tree/v0.13.1/files/fonts) under the GUST Font License; see `public/fonts/LICENSE.txt`. Inter is self-hosted through `@fontsource-variable/inter` under the SIL Open Font License.
