import { useMemo, useState } from 'react';
import { Plus, Trash2, RotateCcw, Minus } from 'lucide-react';
import {
  compileExpression,
  DEFAULT_BOUNDS,
  HEIGHT,
  plotPath,
  ticks,
  WIDTH,
  type Bounds,
} from './plot';

const COLORS = ['#285d49', '#aa4525', '#6452a3', '#226b94', '#93600c', '#a33871'];
const EXAMPLES = ['sin(x)', 'x^2', '1/x', 'sqrt(x)', 'cos(x) * exp(-x^2 / 10)'];

export function PlotView() {
  const [formulas, setFormulas] = useState([{ id: 0, text: 'sin(x)' }]);
  const [nextId, setNextId] = useState(1);
  const [range, setRange] = useState(
    Object.fromEntries(Object.entries(DEFAULT_BOUNDS).map(([key, value]) => [key, String(value)])),
  );
  const bounds = Object.fromEntries(
    Object.entries(range).map(([key, value]) => [key, Number(value)]),
  ) as Bounds;
  const rangeValid =
    Object.values(range).every(
      (value) => value.trim() && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= 1e6,
    ) &&
    bounds.xMax - bounds.xMin >= 1e-6 &&
    bounds.yMax - bounds.yMin >= 1e-6;
  const plotted = useMemo(
    () =>
      formulas.map((formula) => {
        try {
          const fn = compileExpression(formula.text);
          return { ...formula, path: rangeValid ? plotPath(fn, bounds) : '', error: '' };
        } catch (error) {
          return { ...formula, path: '', error: (error as Error).message };
        }
      }),
    [formulas, rangeValid, bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax],
  );
  const display = rangeValid ? bounds : DEFAULT_BOUNDS;
  const sx = (x: number) => ((x - display.xMin) / (display.xMax - display.xMin)) * WIDTH;
  const sy = (y: number) => ((display.yMax - y) / (display.yMax - display.yMin)) * HEIGHT;
  function changeBounds(value: Bounds) {
    setRange(
      Object.fromEntries(Object.entries(value).map(([key, number]) => [key, String(number)])),
    );
  }
  function zoom(factor: number) {
    const cx = (bounds.xMin + bounds.xMax) / 2,
      cy = (bounds.yMin + bounds.yMax) / 2;
    const dx = ((bounds.xMax - bounds.xMin) * factor) / 2,
      dy = ((bounds.yMax - bounds.yMin) * factor) / 2;
    if (Math.min(dx, dy) < 5e-7 || Math.max(Math.abs(cx) + dx, Math.abs(cy) + dy) > 1e6) return;
    changeBounds({ xMin: cx - dx, xMax: cx + dx, yMin: cy - dy, yMax: cy + dy });
  }
  return (
    <section className="plot-workspace" aria-label="Formula plotting">
      <div className="panel plot-controls">
        <div className="panel-heading">
          <h1>Plot your formulas</h1>
          <span className="language-tag">y = f(x)</span>
        </div>
        <div className="plot-settings">
          <p className="plot-help">Enter expressions in x. Curves update as you type.</p>
          {plotted.map((formula, index) => (
            <div className="plot-formula" key={formula.id}>
              <label
                htmlFor={`plot-${formula.id}`}
                style={{ color: COLORS[formula.id % COLORS.length] }}
              >
                y{index + 1} =
              </label>
              <input
                id={`plot-${formula.id}`}
                aria-label={`Plot formula ${index + 1}`}
                aria-invalid={!!formula.error}
                aria-describedby={formula.error ? `plot-error-${formula.id}` : 'plot-syntax'}
                value={formula.text}
                spellCheck={false}
                maxLength={500}
                onChange={(event) =>
                  setFormulas(
                    formulas.map((item) =>
                      item.id === formula.id ? { ...item, text: event.target.value } : item,
                    ),
                  )
                }
              />
              <button
                className="icon-button"
                aria-label={`Remove formula ${index + 1}`}
                disabled={formulas.length === 1}
                onClick={() => setFormulas(formulas.filter((item) => item.id !== formula.id))}
              >
                <Trash2 size={15} />
              </button>
              {formula.error && (
                <p className="plot-error" id={`plot-error-${formula.id}`} role="status">
                  {formula.error}
                </p>
              )}
              {!formula.error && rangeValid && !formula.path.includes('L') && (
                <p className="plot-error" role="status">
                  No curve in this range. Check the domain or axis limits.
                </p>
              )}
            </div>
          ))}
          <button
            className="small-button"
            disabled={formulas.length >= 6}
            onClick={() => {
              setFormulas([...formulas, { id: nextId, text: 'x' }]);
              setNextId(nextId + 1);
            }}
          >
            <Plus size={14} /> Add formula
          </button>
          <h2>Try an example</h2>
          <div className="plot-examples">
            {EXAMPLES.map((example) => (
              <button
                className="small-button"
                key={example}
                onClick={() =>
                  setFormulas(
                    formulas.map((item, index) =>
                      index === 0 ? { ...item, text: example } : item,
                    ),
                  )
                }
              >
                {example}
              </button>
            ))}
          </div>
          <h2>Axis range</h2>
          <div className="plot-ranges">
            {(['xMin', 'xMax', 'yMin', 'yMax'] as const).map((key) => (
              <label key={key}>
                {key[0]} {key.endsWith('Min') ? 'minimum' : 'maximum'}
                <input
                  type="number"
                  step="any"
                  value={range[key]}
                  onChange={(event) => setRange({ ...range, [key]: event.target.value })}
                />
              </label>
            ))}
          </div>
          {!rangeValid && (
            <p className="plot-error" role="status">
              Enter finite limits between −1,000,000 and 1,000,000. Each maximum must exceed its
              minimum by at least 0.000001.
            </p>
          )}
          <p className="plot-help" id="plot-syntax">
            Use +, −, *, /, ^ and parentheses; x, pi, e; sin, cos, tan, asin, acos, atan, sqrt, abs,
            exp, ln, log (base 10), floor, ceil. Use * for multiplication, for example 2*x. Angles
            are in radians. This view uses numeric expressions, not Typst syntax.
          </p>
          <p className="plot-help">
            Plots are sampled approximations. Changes stay here while you switch views; reload
            resets the plot.
          </p>
        </div>
      </div>
      <div className="panel plot-preview">
        <div className="panel-heading">
          <h2>Graph</h2>
          <div className="toolbar-group">
            <button
              className="icon-button"
              aria-label="Zoom plot out"
              disabled={!rangeValid}
              onClick={() => zoom(2)}
            >
              <Minus size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Zoom plot in"
              disabled={!rangeValid}
              onClick={() => zoom(0.5)}
            >
              <Plus size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Reset plot range"
              onClick={() => changeBounds(DEFAULT_BOUNDS)}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
        <div className="plot-canvas">
          <svg
            viewBox={`-55 -20 ${WIDTH + 80} ${HEIGHT + 65}`}
            role="img"
            aria-label={`Formula graph: ${formulas.map((f) => f.text).join('; ')}. x from ${display.xMin} to ${display.xMax}; y from ${display.yMin} to ${display.yMax}.`}
          >
            <defs>
              <clipPath id="plot-clip">
                <rect width={WIDTH} height={HEIGHT} />
              </clipPath>
            </defs>
            <rect width={WIDTH} height={HEIGHT} fill="#fffefb" stroke="#dce3d3" />
            {ticks(display.xMin, display.xMax).map((x) => (
              <g key={`x${x}`}>
                <line
                  x1={sx(x)}
                  x2={sx(x)}
                  y1={0}
                  y2={HEIGHT}
                  stroke={x === 0 ? '#7c8972' : '#e4e7de'}
                />
                <text x={sx(x)} y={HEIGHT + 24} textAnchor="middle">
                  {x}
                </text>
              </g>
            ))}
            {ticks(display.yMin, display.yMax).map((y) => (
              <g key={`y${y}`}>
                <line
                  x1={0}
                  x2={WIDTH}
                  y1={sy(y)}
                  y2={sy(y)}
                  stroke={y === 0 ? '#7c8972' : '#e4e7de'}
                />
                <text x={-10} y={sy(y) + 4} textAnchor="end">
                  {y}
                </text>
              </g>
            ))}
            <text x={WIDTH + 14} y={HEIGHT + 24}>
              x
            </text>
            <text x={-12} y={-8}>
              y
            </text>
            <g clipPath="url(#plot-clip)">
              {plotted.map((formula) => (
                <path
                  key={formula.id}
                  data-testid="plot-curve"
                  d={formula.path}
                  fill="none"
                  stroke={COLORS[formula.id % COLORS.length]}
                  strokeWidth={2.5}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          </svg>
        </div>
        <div className="plot-legend">
          {plotted.map((formula, index) => (
            <span key={formula.id} style={{ color: COLORS[formula.id % COLORS.length] }}>
              y{index + 1} = {formula.text || '…'}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
