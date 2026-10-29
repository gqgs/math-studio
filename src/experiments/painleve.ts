// Adaptive step-doubling RK4. We terminate near poles instead of drawing
// a spurious connecting line through a divergent solution.
export type Sample = { x: number; w: number; derivative: number };
type State = readonly [number, number];

function derivative(x: number, [w, velocity]: State): State {
  return [velocity, 6 * w * w + x];
}

function rk4(x: number, y: State, h: number): State {
  const a = derivative(x, y);
  const b = derivative(x + h / 2, [y[0] + h * a[0] / 2, y[1] + h * a[1] / 2]);
  const c = derivative(x + h / 2, [y[0] + h * b[0] / 2, y[1] + h * b[1] / 2]);
  const d = derivative(x + h, [y[0] + h * c[0], y[1] + h * c[1]]);
  return [
    y[0] + h * (a[0] + 2 * b[0] + 2 * c[0] + d[0]) / 6,
    y[1] + h * (a[1] + 2 * b[1] + 2 * c[1] + d[1]) / 6,
  ];
}

function integrateDirection(k: number, end: number): Sample[] {
  const sign = Math.sign(end);
  let x = 0;
  let y: State = [0, k];
  let h = sign * 0.04;
  const samples: Sample[] = [{ x, w: y[0], derivative: y[1] }];
  const minStep = 1e-7;

  for (let count = 0; count < 250000 && sign * (end - x) > 1e-12; count++) {
    const step = sign * Math.min(Math.abs(h), Math.abs(end - x));
    const full = rk4(x, y, step);
    const half = rk4(x, y, step / 2);
    const fine = rk4(x + step / 2, half, step / 2);
    const scale = (index: 0 | 1) =>
      1e-8 + 2e-7 * Math.max(Math.abs(y[index]), Math.abs(fine[index]));
    const error = Math.max(
      Math.abs(fine[0] - full[0]) / (15 * scale(0)),
      Math.abs(fine[1] - full[1]) / (15 * scale(1)),
    );

    if (!Number.isFinite(error)) break;
    if (error <= 1) {
      const next: State = [
        fine[0] + (fine[0] - full[0]) / 15,
        fine[1] + (fine[1] - full[1]) / 15,
      ];
      // Pole detection: a numerical solution cannot be continued through a pole.
      if (!next.every(Number.isFinite) || Math.abs(next[0]) > 40 ||
          Math.abs(next[1]) > 1000) break;
      x += step;
      y = next;
      samples.push({ x, w: y[0], derivative: y[1] });
    }

    const factor = error === 0 ? 2 : Math.max(0.2, Math.min(2, 0.9 * Math.pow(error, -0.2)));
    h = sign * Math.min(0.1, Math.abs(step) * factor);
    if (Math.abs(h) < minStep) break;
  }

  return samples;
}

export function solvePainleve(k: number, minX = -12, maxX = 2.4): Sample[] {
  if (!Number.isFinite(k) || minX >= 0 || maxX <= 0) {
    throw new Error('Expected finite k and a domain containing x = 0');
  }
  const backwards = integrateDirection(k, minX).reverse();
  const forwards = integrateDirection(k, maxX);
  return [...backwards, ...forwards.slice(1)];
}
