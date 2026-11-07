// npm's predev/prebuild hooks run this before Vite can serve an HTML fallback
// for a missing WASM asset. Julia is a build-time dependency, never a browser dependency.
import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const asset = new URL('../public/julia-wasm/logistic_step.wasm', import.meta.url);
const sources = [
  new URL('../julia-wasm/build.jl', import.meta.url),
  new URL('../julia-wasm/Project.toml', import.meta.url),
];

async function upToDate() {
  try {
    const [target, ...inputs] = await Promise.all([asset, ...sources].map((path) => stat(path)));
    if (inputs.some((input) => input.mtimeMs > target.mtimeMs)) return false;
    const bytes = await readFile(asset);
    if (!WebAssembly.validate(bytes)) return false;
    const module = new WebAssembly.Module(bytes);
    return WebAssembly.Module.imports(module).length === 0 &&
      WebAssembly.Module.exports(module).some((item) =>
        item.kind === 'function' && item.name === 'logistic_step');
  } catch {
    return false;
  }
}

if (!(await upToDate())) {
  console.log('Generating Julia/WASM module for Math Studio…');
  const command = 'julia';
  const args = ['--project=julia-wasm', '-e',
    'using Pkg; Pkg.instantiate(); include("julia-wasm/build.jl")'];
  const run = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (run.error?.code === 'ENOENT') {
    console.error(
      'Julia 1.12 is required to generate the missing logistic_step.wasm. ' +
      'Install Julia 1.12, then rerun npm run dev. See docs/julia-wasm-poc.md.',
    );
    process.exit(1);
  }
  if (run.error) throw run.error;
  if (run.status !== 0) process.exit(run.status || 1);
  if (!(await upToDate())) {
    console.error('Julia produced no valid, current logistic_step.wasm; stopping before Vite starts.');
    process.exit(1);
  }
  console.log('Julia/WASM module ready.');
}
