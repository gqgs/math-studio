import { describe, expect, it } from 'vitest';
import { solvePainleve } from './painleve';
import { EXPERIMENTS, clampParameter, initialParameters } from './catalog';

describe('Painlevé I integration', () => {
  it('respects initial conditions and increasing x order', () => {
    const samples = solvePainleve(0.75, -2, 1);
    const zero = samples.find((sample) => sample.x === 0);
    expect(zero).toEqual({ x: 0, w: 0, derivative: 0.75 });
    expect(samples.length).toBeGreaterThan(20);
    expect(samples.every((point) => Number.isFinite(point.w) &&
      Number.isFinite(point.derivative))).toBe(true);
    expect(samples.every((point, index) => index === 0 || samples[index - 1].x < point.x)).toBe(true);
  });

  it('matches the local Taylor expansion around the origin', () => {
    const samples = solvePainleve(0, -1, 1);
    const near = samples.find((sample) => sample.x > 0.08 && sample.x < 0.15);
    expect(near).toBeDefined();
    // w(0)=w'(0)=w''(0)=0, w'''(0)=1.
    expect(near!.w).toBeCloseTo(near!.x ** 3 / 6, 4);
  });

  it('stops at numerical poles rather than continuing through them', () => {
    const samples = solvePainleve(2, -12, 2.4);
    expect(samples.every((sample) => Math.abs(sample.w) <= 40)).toBe(true);
    expect(samples.every((sample) => Math.abs(sample.derivative) <= 1000)).toBe(true);
  });

  it('rejects invalid input', () => {
    expect(() => solvePainleve(Number.NaN)).toThrow();
    expect(() => solvePainleve(1, 0, 2)).toThrow();
  });
});

describe('experiment metadata', () => {
  it('generates defaults and clamps invalid parameter values', () => {
    const model = EXPERIMENTS[0];
    expect(initialParameters(model)).toMatchObject({ frequency: 14, curvature: 1.1 });
    expect(clampParameter(model.parameters[0], 100)).toBe(30);
    expect(clampParameter(model.parameters[0], Number.NaN)).toBe(14);
  });
});
