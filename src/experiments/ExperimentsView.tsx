import { useState } from 'react';
import { PARAMETERS, PRESETS, clampParameter, initialParameters } from './catalog';
import { parseExpression, type ExpressionNode } from './expression';
import { TSLField } from './TSLField';
import './experiments.css';

type Values = ReturnType<typeof initialParameters>;

export function ExperimentsView() {
  const [draft, setDraft] = useState<string>(PRESETS[0].formula);
  const [expression, setExpression] = useState<ExpressionNode>(
    () => parseExpression(PRESETS[0].formula),
  );
  const [error, setError] = useState('');
  const [values, setValues] = useState<Values>(initialParameters);
  const [playing, setPlaying] = useState(true);
  const [backend, setBackend] = useState<'auto' | 'webgl'>('auto');

  function applyFormula() {
    try {
      const parsed = parseExpression(draft);
      setExpression(parsed);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invalid expression');
    }
  }

  function selectPreset(preset: (typeof PRESETS)[number]) {
    setDraft(preset.formula);
    setExpression(parseExpression(preset.formula));
    setValues({ ...preset.values });
    setError('');
    setPlaying(true);
  }

  function setParameter(id: Values extends Record<infer K, number> ? K : never, raw: number) {
    const parameter = PARAMETERS.find((item) => item.id === id);
    if (!parameter || !Number.isFinite(raw)) return;
    setValues((current) => ({ ...current, [id]: clampParameter(parameter, raw) }));
  }

  return (
    <section className="experiment-workspace" aria-label="Mathematical shader experiments">
      <header className="experiment-intro">
        <div>
          <span className="eyebrow">MATHEMATICAL EXPERIMENTS</span>
          <h1>Explore the <em>equation.</em></h1>
          <p>Enter a scalar expression, adjust its parameters, and render it on the GPU using TSL.</p>
        </div>
      </header>
      <div className="experiment-layout">
        <div className="panel experiment-controls">
          <div className="panel-heading">
            <h2>Scalar field editor</h2>
            <span className="language-tag">TSL / GPU</span>
          </div>
          <div className="experiment-control-body">
            <label className="experiment-label" htmlFor="experiment-formula">f(x, y, t, a, b)</label>
            <textarea id="experiment-formula"
              className="experiment-formula-input"
              spellCheck={false}
              value={draft}
              rows={6}
              aria-invalid={!!error}
              aria-describedby={error ? 'experiment-formula-error' : 'experiment-formula-help'}
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) setError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  applyFormula();
                }
              }}
            />
            {error ? (
              <p className="experiment-formula-error" id="experiment-formula-error" role="alert">{error}</p>
            ) : (
              <p className="experiment-formula-help" id="experiment-formula-help">
                x and y range from −1 to 1; t is animated. a and b are sliders.
                Use explicit multiplication (*), powers (^), and functions such as
                sin, cos, tan, abs, sqrt, exp, log, min, max, pow, clamp, and smoothstep.
              </p>
            )}
            <button className="experiment-apply" type="button" onClick={applyFormula}>
              Apply formula <span>Ctrl+Enter</span>
            </button>
            <div className="experiment-section-title">Examples</div>
            <div className="experiment-presets">
              {PRESETS.map((preset) => (
                <button key={preset.name} type="button" onClick={() => selectPreset(preset)}>
                  {preset.name}
                </button>
              ))}
            </div>
            <div className="experiment-section-title">Parameters</div>
            {PARAMETERS.map((parameter) => (
              <div className="experiment-parameter" key={parameter.id}>
                <div className="experiment-parameter-head">
                  <label htmlFor={'experiment-' + parameter.id}>{parameter.label}</label>
                  <input aria-label={parameter.label + ' numeric value'} type="number"
                    min={parameter.min} max={parameter.max} step={parameter.step}
                    value={values[parameter.id]}
                    onChange={(event) => setParameter(parameter.id, Number(event.target.value))} />
                </div>
                <input id={'experiment-' + parameter.id} type="range"
                  min={parameter.min} max={parameter.max} step={parameter.step}
                  value={values[parameter.id]} aria-label={parameter.label}
                  onChange={(event) => setParameter(parameter.id, Number(event.target.value))} />
                <p>{parameter.description}</p>
              </div>
            ))}
            <div className="experiment-playback">
              <button type="button" onClick={() => setPlaying((previous) => !previous)}>
                {playing ? 'Pause' : 'Play'}
              </button>
              <button type="button" onClick={() => selectPreset(PRESETS[0])}>Reset</button>
            </div>
            <div className="experiment-backend">
              <label htmlFor="experiment-backend">Rendering backend</label>
              <select id="experiment-backend" value={backend}
                onChange={(event) => setBackend(event.target.value === 'webgl' ? 'webgl' : 'auto')}>
                <option value="auto">Auto (WebGPU preferred)</option>
                <option value="webgl">Force WebGL 2</option>
              </select>
            </div>
          </div>
        </div>
        <div className="panel experiment-display">
          <div className="panel-heading">
            <h2>Scalar field · f(x,y,t,a,b)</h2>
            <span className="language-tag">GPU-generated</span>
          </div>
          <TSLField expression={expression} a={values.a} b={values.b}
            speed={values.speed} playing={playing} backend={backend} />
          <div className="experiment-footer">
            <a href="https://threejs.org/tsl/" target="_blank" rel="noreferrer">
              Three.js Shading Language
            </a>
            <span>Only bounded mathematical expressions are supported; no arbitrary JavaScript.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
