/**
 * The logistic map is implemented in Julia, not JavaScript.
 * Generated at build time by julia-wasm/build.jl using WasmTarget.jl.
 */
export type LogisticStep = (x: number, r: number) => number;

export async function loadLogisticStep(): Promise<LogisticStep> {
  const url = import.meta.env.BASE_URL + 'julia-wasm/logistic_step.wasm';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Julia/WASM module unavailable (HTTP ' + response.status +
      '). Run npm run wasm:build before starting the app.');
  }
  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes);
  const exported = instance.exports.logistic_step;
  if (typeof exported !== 'function') {
    throw new Error('The compiled Julia module does not export logistic_step.');
  }
  // The kernel uses only f64 parameters/results; no host imports or GC-boundary arrays.
  return exported as LogisticStep;
}

export function computeOrbit(step: LogisticStep, x0: number, r: number, iterations: number): number[] {
  const orbit = [x0];
  let x = x0;
  for (let i = 0; i < iterations; i += 1) {
    x = step(x, r);
    if (!Number.isFinite(x)) throw new Error('The Julia/WASM kernel returned a non-finite value.');
    orbit.push(x);
  }
  return orbit;
}
