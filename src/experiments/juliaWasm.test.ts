import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeOrbit, loadLogisticStep } from './juliaWasm';

afterEach(() => vi.unstubAllGlobals());

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

  it('reports an HTML fallback instead of attempting to instantiate it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('<!doctype html><html></html>', {
        headers: { 'content-type': 'text/html' },
      }),
    ));
    await expect(loadLogisticStep()).rejects.toThrow(/not WebAssembly.*text\/html/);
  });

  it('reports a missing asset with its HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not found', { status: 404 })));
    await expect(loadLogisticStep()).rejects.toThrow(/HTTP 404/);
  });
});
