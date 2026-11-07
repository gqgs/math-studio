// npm's predev/prebuild hooks run this before Vite can serve an HTML fallback
// for a missing WASM asset. Julia is a build-time dependency, never a browser dependency.
import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { explainJuliaFailure } from './julia-process.mjs';

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
  const command = process.env.JULIA_BIN?.trim() || 'julia';
  console.log('Julia executable:', command);
  const version = spawnSync(command, ['--version'], { cwd: root, encoding: 'utf8' });
  const versionError = explainJuliaFailure(version, command);
  if (versionError) {
    console.error(versionError);
    process.exitCode = 1;
    process.exit();
  }
  console.log('Julia version:', version.stdout.trim());

  // Report both numeric exit codes and signals. Previously a SIGSEGV returned
  // status=null, then process.exit(1) silently swallowed the actual failure.
  const args = ['--project=julia-wasm', '-e',
    'using Pkg; Pkg.instantiate(); include("julia-wasm/build.jl")'];
  const run = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  const failure = explainJuliaFailure(run, command);
  if (failure) {
    console.error(failure);
    console.error('The Vite server was not started because the Julia/WASM build failed.');
    process.exitCode = 1;
    process.exit();
  }
  if (!(await upToDate())) {
    console.error('Julia produced no valid, current logistic_step.wasm; stopping before Vite starts.');
    process.exit(1);
  }
  console.log('Julia/WASM module ready.');
}
