/**
 * The logistic map is implemented in Julia, not JavaScript.
 * Generated at build time by julia-wasm/build.jl using WasmTarget.jl.
 */
export type LogisticStep = (x: number, r: number) => number;

export async function loadLogisticStep(): Promise<LogisticStep> {
  const url = import.meta.env.BASE_URL + 'julia-wasm/logistic_step.wasm';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      'Julia/WASM asset unavailable (HTTP ' + response.status + ') at ' + url +
      '. Run npm run dev to generate it, or verify the deployed asset path.',
    );
  }

  const bytes = await response.arrayBuffer();
  // Vite's SPA fallback can return index.html with HTTP 200 for a missing
  // .wasm file. Check the actual bytes before trying to instantiate HTML.
  const header = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
  if (header.length !== 4 || header[0] !== 0x00 || header[1] !== 0x61 ||
      header[2] !== 0x73 || header[3] !== 0x6d) {
    const type = response.headers.get('content-type') ?? 'unknown content type';
    throw new Error(
      'Julia/WASM asset is not WebAssembly (' + type + ') at ' + url +
      '. The server may be returning HTML for a missing file. ' +
      'Restart with npm run dev to generate the asset, or check your deployment.',
    );
  }

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
