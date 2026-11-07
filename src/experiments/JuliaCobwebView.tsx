import { useEffect, useMemo, useRef, useState } from 'react';
import { computeOrbit, loadLogisticStep, type LogisticStep } from './juliaWasm';

const W = 880;
const H = 580;
const M = { left: 58, right: 24, top: 26, bottom: 52 };
const xPx = (x: number) => M.left + x * (W - M.left - M.right);
const yPx = (y: number) => H - M.bottom - y * (H - M.top - M.bottom);
const clip = (x: number) => Math.min(1, Math.max(0, x));

function paint(canvas: HTMLCanvasElement, step: LogisticStep, r: number, orbit: number[], count: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a131f';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#283648';
  ctx.fillStyle = '#9caec3';
  ctx.lineWidth = 1;
  ctx.font = '12px ui-monospace, monospace';
  for (let n = 0; n <= 10; n += 1) {
    const v = n / 10;
    ctx.beginPath();
    ctx.moveTo(xPx(v), yPx(0));
    ctx.lineTo(xPx(v), yPx(1));
    ctx.moveTo(xPx(0), yPx(v));
    ctx.lineTo(xPx(1), yPx(v));
    ctx.stroke();
    if (n % 2 === 0) {
      ctx.fillText(v.toFixed(1), xPx(v) - 12, yPx(0) + 23);
      ctx.fillText(v.toFixed(1), 17, yPx(v) + 4);
    }
  }
  ctx.fillText('xₙ', W / 2, H - 8);
  ctx.fillText('xₙ₊₁', 8, 14);

  // Identity line y=x.
  ctx.strokeStyle = '#7992ab';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(xPx(0), yPx(0));
  ctx.lineTo(xPx(1), yPx(1));
  ctx.stroke();
  ctx.setLineDash([]);

  // Every curve sample calls the compiled Julia function.
  ctx.strokeStyle = '#69d6c0';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let n = 0; n <= 400; n += 1) {
    const x = n / 400;
    const y = step(x, r);
    if (n === 0) ctx.moveTo(xPx(x), yPx(y));
    else ctx.lineTo(xPx(x), yPx(y));
  }
  ctx.stroke();

  // Standard cobweb construction: vertical to f(x), horizontal to y=x.
  ctx.strokeStyle = '#f4bc76';
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  ctx.moveTo(xPx(orbit[0]), yPx(0));
  for (let n = 0; n < count; n += 1) {
    ctx.lineTo(xPx(orbit[n]), yPx(orbit[n + 1]));
    ctx.lineTo(xPx(orbit[n + 1]), yPx(orbit[n + 1]));
  }
  ctx.stroke();
  ctx.fillStyle = '#f4bc76';
  ctx.beginPath();
  ctx.arc(xPx(orbit[count]), yPx(count === 0 ? 0 : orbit[count]), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#69d6c0';
  ctx.fillText('f(x) = r·x·(1−x)', xPx(0.04), yPx(0.96));
}

export function JuliaCobwebView() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [step, setStep] = useState<LogisticStep | null>(null);
  const [error, setError] = useState('');
  const [r, setR] = useState(3.7);
  const [x0, setX0] = useState(0.2);
  const [iterations, setIterations] = useState(32);
  const [visible, setVisible] = useState(12);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadLogisticStep().then(
      (kernel) => { if (mounted) setStep(() => kernel); },
      (cause: unknown) => { if (mounted) setError(cause instanceof Error ? cause.message : String(cause)); },
    );
    return () => { mounted = false; };
  }, []);

  const orbit = useMemo(
    () => step ? computeOrbit(step, x0, r, iterations) : null,
    [step, x0, r, iterations],
  );

  useEffect(() => {
    setPlaying(false);
    setVisible((value) => Math.min(value, iterations));
  }, [r, x0, iterations]);

  useEffect(() => {
    if (!playing || !step || visible >= iterations) return;
    const timer = window.setTimeout(() => setVisible((n) => Math.min(n + 1, iterations)), 150);
    return () => window.clearTimeout(timer);
  }, [playing, step, visible, iterations]);

  useEffect(() => {
    if (playing && visible >= iterations) setPlaying(false);
  }, [playing, visible, iterations]);

  useEffect(() => {
    if (canvas.current && step && orbit) paint(canvas.current, step, r, orbit, visible);
  }, [step, orbit, r, visible]);

  const current = orbit?.[visible];
  const setInitialFromCanvas = (clientX: number) => {
    const element = canvas.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setX0(Number(clip((clientX - rect.left - (M.left / W) * rect.width) /
      ((W - M.left - M.right) / W * rect.width)).toFixed(3)));
  };

  return (
    <div className="experiment-layout" aria-label="Julia WebAssembly cobweb proof of concept">
      <div className="panel experiment-controls">
        <div className="experiment-control-body">
          <div className="cobweb-intro">
            Logistic map cobweb: xₙ₊₁ = r·xₙ·(1−xₙ).
            Computation comes from a Julia function compiled to WasmGC, with no Julia server.
          </div>
          <div className="experiment-parameter">
            <div className="experiment-parameter-head">
              <label htmlFor="cobweb-r">Growth parameter r</label>
              <output>{r.toFixed(3)}</output>
            </div>
            <input id="cobweb-r" type="range" min="0" max="4" step="0.001"
              value={r} onChange={(event) => setR(Number(event.target.value))} />
          </div>
          <div className="experiment-parameter">
            <div className="experiment-parameter-head">
              <label htmlFor="cobweb-x0">Initial state x₀</label>
              <output>{x0.toFixed(3)}</output>
            </div>
            <input id="cobweb-x0" type="range" min="0" max="1" step="0.001"
              value={x0} onChange={(event) => setX0(Number(event.target.value))} />
          </div>
          <div className="experiment-parameter">
            <div className="experiment-parameter-head">
              <label htmlFor="cobweb-length">Iterations</label>
              <output>{iterations}</output>
            </div>
            <input id="cobweb-length" type="range" min="1" max="100" step="1"
              value={iterations} onChange={(event) => setIterations(Number(event.target.value))} />
          </div>
          <div className="experiment-playback">
            <button type="button" disabled={!step} onClick={() => {
              if (playing) setPlaying(false);
              else {
                if (visible >= iterations) setVisible(0);
                setPlaying(true);
              }
            }}>{playing ? 'Pause' : 'Play'}</button>
            <button type="button" disabled={!step} onClick={() => {
              setPlaying(false); setVisible((n) => Math.min(n + 1, iterations));
            }}>Step</button>
            <button type="button" disabled={!step} onClick={() => {
              setPlaying(false); setVisible(0);
            }}>Rewind</button>
          </div>
          <div className="cobweb-meta" aria-live="polite">
            {step ? 'Julia/WASM loaded · ' + visible + '/' + iterations + ' steps'
              : error ? 'WASM unavailable' : 'Loading Julia/WASM…'}
            {typeof current === 'number' && ' · x = ' + current.toFixed(6)}
          </div>
          <p className="experiment-note">Click the graph to change x₀, then step or play the trajectory.</p>
          <p className="experiment-note">
            This PoC compiles a single Julia numerical kernel, not DynamicalSystems.jl or Makie.
          </p>
        </div>
      </div>
      <div className="panel experiment-display">
        <div className="cobweb-plot">
          {error ? <p role="alert" className="cobweb-error">{error}</p> : null}
          <canvas ref={canvas} width={W} height={H} role="button" tabIndex={0}
            aria-label="Cobweb graph. Click to set initial x, or use arrow keys to adjust it."
            onPointerDown={(event) => setInitialFromCanvas(event.clientX)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                setX0((value) => Number(clip(value + (event.key === 'ArrowRight' ? 0.01 : -0.01)).toFixed(3)));
              }
            }}
          />
        </div>
        <div className="experiment-footer">
          <span>Julia → WasmTarget.jl → WebAssembly GC → Canvas 2D</span>
          <a href="https://juliadynamics.github.io/DynamicalSystemsDocs.jl/dynamicalsystems/stable/visualizations/"
            target="_blank" rel="noreferrer">JuliaDynamics reference</a>
        </div>
      </div>
    </div>
  );
}
