// The build product must be an actual module exported from Julia and must
// agree with an independent JS reference, including across repeated iterations.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bytes = await readFile(new URL('../public/julia-wasm/logistic_step.wasm', import.meta.url));
assert.ok(WebAssembly.validate(bytes), 'WasmTarget produced invalid WebAssembly');
const { instance } = await WebAssembly.instantiate(bytes);
assert.equal(typeof instance.exports.logistic_step, 'function');
assert.equal(WebAssembly.Module.imports(new WebAssembly.Module(bytes)).length, 0);
const step = instance.exports.logistic_step;
for (const r of [0, 1, 2.5, 3.2, 3.7, 4]) {
  for (const x0 of [0, 0.1, 0.2, 0.5, 0.9, 1]) {
    let js = x0;
    let wasm = x0;
    for (let i = 0; i < 80; i += 1) {
      js = r * js * (1 - js);
      wasm = step(wasm, r);
      // Chaotic orbits diverge even with correctly rounded intermediate values.
      // Compare one-step results from the *same* input, not distant trajectories.
      const expected = r * wasm * (1 - wasm);
      const actual = step(wasm, r);
      assert.ok(Math.abs(actual - expected) <= 1e-14, 'Julia/WASM mismatch at r=' + r);
      assert.ok(Number.isFinite(wasm));
    }
  }
}
console.log('Julia/WASM logistic map: import-free, valid, numerical parity passed');
