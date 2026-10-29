import { useEffect, useMemo, useRef, useState } from 'react';
import { EXPERIMENTS, clampParameter, initialParameters, type Experiment } from './catalog';
import { TSLField } from './TSLField';
import { PainlevePlot } from './PainlevePlot';
import './experiments.css';

export function ExperimentsView() {
  const [selectedId, setSelectedId] = useState<Experiment['id']>('interference');
  const experiment = useMemo(
    () => EXPERIMENTS.find((entry) => entry.id === selectedId)!,
    [selectedId],
  );
  const [values, setValues] = useState<Record<string, number>>(() => initialParameters(EXPERIMENTS[0]));
  const [playing, setPlaying] = useState(true);
  const [backend, setBackend] = useState<'auto' | 'webgl'>('auto');
  const frame = useRef<number | null>(null);

  function selectExperiment(next: Experiment) {
    setSelectedId(next.id);
    setValues(initialParameters(next));
    setPlaying(next.type === 'shader');
  }

  function setParameter(id: string, raw: number) {
    const parameter = experiment.parameters.find((item) => item.id === id);
    if (!parameter || !Number.isFinite(raw)) return;
    setValues((current) => ({ ...current, [id]: clampParameter(parameter, raw) }));
  }

  // Animate the numerical initial condition at a modest sampling rate.
  // Shader experiments instead advance their GPU time uniform every frame.
  useEffect(() => {
    if (experiment.type !== 'numerical' || !playing) return;
    const start = performance.now();
    const anchor = values.k;
    let last = 0;
    const parameter = experiment.parameters.find((item) => item.id === 'k')!;
    const tick = (now: number) => {
      if (now - last >= 90) {
        last = now;
        const offset = 0.02 * Math.sin((now - start) / 1750);
        setValues((current) => ({ ...current, k: clampParameter(parameter, anchor + offset) }));
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
    // Deliberately anchor a sweep when Play is pressed, not at every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, selectedId]);

  return (
    <section className="experiment-workspace" aria-label="Mathematical experiments">
      <header className="experiment-intro">
        <div>
          <span className="eyebrow">MATHEMATICAL EXPERIMENTS</span>
          <h1>Explore the <em>equation.</em></h1>
          <p>Change parameters, sweep through solutions, and compare a shader with a numerical model.</p>
        </div>
      </header>
      <div className="experiment-layout">
        <div className="panel experiment-controls">
          <div className="panel-heading">
            <h2>Experiment</h2>
            <span className="language-tag">{experiment.type === 'shader' ? 'TSL / GPU' : 'ODE / CPU'}</span>
          </div>
          <div className="experiment-control-body">
            <label className="experiment-label" htmlFor="experiment-picker">Choose a model</label>
            <select id="experiment-picker" value={experiment.id}
              onChange={(event) => {
                const next = EXPERIMENTS.find((entry) => entry.id === event.target.value);
                if (next) selectExperiment(next);
              }}>
              {EXPERIMENTS.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <p className="experiment-description">{experiment.subtitle}</p>
            <div className="experiment-equation">{experiment.equation}</div>
            <div className="experiment-section-title">Presets</div>
            <div className="experiment-presets">
              {experiment.presets.map((preset) => (
                <button key={preset.name} type="button" onClick={() => {
                  setPlaying(false);
                  setValues(preset.values);
                }}>{preset.name}</button>
              ))}
            </div>
            <div className="experiment-section-title">Parameters</div>
            {experiment.parameters.map((parameter) => (
              <div className="experiment-parameter" key={parameter.id}>
                <div className="experiment-parameter-head">
                  <label htmlFor={'experiment-' + parameter.id}>{parameter.label}</label>
                  <input aria-label={parameter.label + ' numeric value'} type="number"
                    min={parameter.min} max={parameter.max} step={parameter.step}
                    value={values[parameter.id]} onChange={(event) =>
                      setParameter(parameter.id, Number(event.target.value))} />
                </div>
                <input id={'experiment-' + parameter.id} type="range"
                  min={parameter.min} max={parameter.max} step={parameter.step}
                  value={values[parameter.id]} aria-label={parameter.label}
                  onChange={(event) => setParameter(parameter.id, Number(event.target.value))} />
                <p>{parameter.description}</p>
              </div>
            ))}
            <div className="experiment-playback">
              <button type="button" onClick={() => setPlaying((value) => !value)}>
                {playing ? 'Pause' : 'Play sweep'}
              </button>
              <button type="button" onClick={() => {
                setPlaying(false);
                setValues(initialParameters(experiment));
              }}>Reset</button>
            </div>
            {experiment.type === 'shader' && (
              <div className="experiment-backend">
                <label htmlFor="experiment-backend">Rendering backend</label>
                <select id="experiment-backend" value={backend} onChange={(event) =>
                  setBackend(event.target.value === 'webgl' ? 'webgl' : 'auto')}>
                  <option value="auto">Auto (WebGPU preferred)</option>
                  <option value="webgl">Force WebGL 2</option>
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="panel experiment-display">
          <div className="panel-heading">
            <h2>{experiment.name}</h2>
            <span className="language-tag">{experiment.type === 'shader' ? 'GPU-generated' : 'Adaptive RK4'}</span>
          </div>
          {experiment.id === 'interference' ? (
            <TSLField frequency={values.frequency} curvature={values.curvature}
              speed={values.speed} playing={playing} backend={backend} />
          ) : (
            <PainlevePlot k={values.k} delta={values.delta} />
          )}
          <div className="experiment-footer">
            {experiment.id === 'painleve' ? (
              <a href="https://dlmf.nist.gov/32.3" target="_blank" rel="noreferrer">
                NIST DLMF §32.3 — reference graphics
              </a>
            ) : (
              <a href="https://threejs.org/tsl/" target="_blank" rel="noreferrer">
                Three.js Shading Language
              </a>
            )}
            <span>All computation stays in your browser.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
