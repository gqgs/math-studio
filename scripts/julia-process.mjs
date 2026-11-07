/**
 * Explain Julia subprocess failures before npm's lifecycle hook terminates.
 * spawnSync returns status=null when the child is terminated by a signal.
 */
export function explainJuliaFailure(result, executable = 'julia') {
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      return `Julia executable "${executable}" was not found. Install the official Julia 1.12 via Juliaup, or set JULIA_BIN to its executable path. See docs/julia-wasm-poc.md.`;
    }
    return `Unable to run Julia ("${executable}"): ${result.error.message}`;
  }
  if (result.signal || result.status !== 0) {
    const detail = result.signal
      ? `terminated by signal ${result.signal}`
      : `exited with status ${result.status ?? 'unknown'}`;
    const segfault = result.signal === 'SIGSEGV' || result.status === 139;
    const suffix = segfault
      ? ' This is a native Julia crash (SIGSEGV), not a Vite or WebAssembly error. The Math Studio PoC is verified with official Julia 1.12; check which Julia executable is selected.'
      : ' Check the Julia output above. The Math Studio PoC CI is verified with Julia 1.12.';
    return `Julia ("${executable}") ${detail} while generating logistic_step.wasm.${suffix}`;
  }
  return null;
}
