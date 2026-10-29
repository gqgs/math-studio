import { useMemo } from 'react';
import { solvePainleve, type Sample } from './painleve';

const xmin = -12;
const xmax = 2.4;
const ymin = -2.5;
const ymax = 2.5;
const width = 880;
const height = 540;
const left = 58;
const right = 22;
const top = 28;
const bottom = 48;
const sx = (x: number) => left + (x - xmin) / (xmax - xmin) * (width - left - right);
const sy = (y: number) => top + (ymax - y) / (ymax - ymin) * (height - top - bottom);

function curvePath(samples: readonly Sample[]): string {
  let path = '';
  let drawing = false;
  for (const { x, w } of samples) {
    if (!Number.isFinite(w) || w < ymin || w > ymax) {
      drawing = false;
      continue;
    }
    path += (drawing ? 'L' : 'M') + sx(x).toFixed(2) + ',' + sy(w).toFixed(2) + ' ';
    drawing = true;
  }
  return path;
}

function referencePath(sign: 1 | -1): string {
  const samples: Sample[] = [];
  for (let i = 0; i <= 400; i++) {
    const x = xmin * (1 - i / 400);
    samples.push({ x, w: sign * Math.sqrt(-x / 6), derivative: 0 });
  }
  return curvePath(samples);
}

export function PainlevePlot({ k, delta }: { k: number; delta: number }) {
  const paths = useMemo(
    () => [curvePath(solvePainleve(k)), curvePath(solvePainleve(k + delta))],
    [k, delta],
  );
  const close = Math.abs(delta) < 0.0001;

  return (
    <div className="experiment-plot">
      <svg viewBox="0 0 880 540" role="img"
        aria-label="Painlevé I solutions from x minus twelve to 2.4 for the selected initial slopes, with reference parabola">
        <rect x={left} y={top} width={width - left - right}
          height={height - top - bottom} fill="var(--plot-bg)" />
        {[-12, -9, -6, -3, 0, 2].map((x) => (
          <g key={x}>
            <line x1={sx(x)} x2={sx(x)} y1={top} y2={height - bottom}
              stroke="var(--plot-grid)" strokeDasharray="3 5" />
            <text x={sx(x)} y={height - 24} fontSize="13" fill="var(--muted)" textAnchor="middle">{x}</text>
          </g>
        ))}
        {[-2, -1, 0, 1, 2].map((y) => (
          <g key={y}>
            <line x1={left} x2={width - right} y1={sy(y)} y2={sy(y)}
              stroke="var(--plot-grid)" strokeDasharray="3 5" />
            <text x={left - 12} y={sy(y) + 4} fontSize="13"
              fill="var(--muted)" textAnchor="end">{y}</text>
          </g>
        ))}
        <line x1={left} x2={width-right} y1={sy(0)} y2={sy(0)}
          stroke="var(--plot-axis)" strokeWidth="1.4" />
        <line x1={sx(0)} x2={sx(0)} y1={top} y2={height-bottom}
          stroke="var(--plot-axis)" strokeWidth="1.4" />
        <path d={referencePath(1)} stroke="var(--muted)" opacity=".65" strokeWidth="1.8" fill="none" />
        <path d={referencePath(-1)} stroke="var(--muted)" opacity=".65" strokeWidth="1.8" fill="none" />
        {paths.map((path, index) => (
          <path key={index} d={path} stroke={index === 0 ? '#d57b44' : '#507bbc'}
            strokeWidth={close ? 2.2 : 2.0} fill="none"
            strokeLinejoin="round" strokeLinecap="round" />
        ))}
        <text x={width-32} y={sy(0)-10} fill="var(--muted)" textAnchor="end" fontSize="16">x</text>
        <text x={sx(0)+12} y={top+12} fill="var(--muted)" fontSize="16">w</text>
      </svg>
      <div className="experiment-legend">
        <span><i style={{ background: '#d57b44' }} /> k = {k.toFixed(6)}</span>
        <span><i style={{ background: '#507bbc' }} /> k + Δ = {(k + delta).toFixed(6)}</span>
        <span><i style={{ background: 'var(--muted)' }} /> 6w² + x = 0 (reference)</span>
      </div>
      <p className="experiment-note">
        Curves stop near numerical poles; they are not joined across singularities.
        Close trajectories can separate dramatically when followed backward.
      </p>
    </div>
  );
}
