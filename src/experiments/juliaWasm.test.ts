import { describe, expect, it } from 'vitest';
import { computeOrbit } from './juliaWasm';

describe('Julia/WASM adapter', () => {
  const logistic = (x: number, r: number) => r * x * (1 - x);

  it('records the initial state and one step per iteration', () => {
    const orbit = computeOrbit(logistic, 0.2, 4, 2);
    expect(orbit).toHaveLength(3);
    expect(orbit[0]).toBe(0.2);
    expect(orbit[1]).toBeCloseTo(0.64, 12);
    expect(orbit[2]).toBeCloseTo(0.9216, 12);
  });

  it('rejects non-finite results rather than plotting corrupt coordinates', () => {
    expect(() => computeOrbit(() => Infinity, 0.2, 4, 1)).toThrow(/non-finite/);
  });
});
