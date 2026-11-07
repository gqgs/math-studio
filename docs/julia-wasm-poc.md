# Julia/WASM cobweb proof of concept

This experiment tests a **real Julia numerical kernel compiled to WebAssembly**
and used interactively by Math Studio, without a Julia server. It is deliberately
smaller than porting DynamicalSystems.jl or Makie.

- Julia source: `julia-wasm/build.jl`. A Float64 logistic-map step is compiled
  with `WasmTarget.jl` 0.5.3 to an import-free WasmGC module.
- Browser adapter: `src/experiments/juliaWasm.ts`. It loads and validates the
  compiled export, with **no JavaScript numerical fallback**.
- View: `src/experiments/JuliaCobwebView.tsx`. Canvas draws the logistic map,
  diagonal, and an animated cobweb. The map evaluations and iterates call WASM.
- CI builds WASM **before** Vite and tests the actual artifact in Node.js 24.
  The generated binary is intentionally not checked into source control.

## Reproduce locally

Install Julia 1.12 and Node.js 24 or newer:

```sh
npm ci
npm run dev
```

`npm run dev` now generates `public/julia-wasm/logistic_step.wasm` automatically
if missing, invalid, or older than the Julia source. The same guard runs before
`npm run build`. It installs the Julia project dependencies as needed. To
regenerate explicitly, run `npm run wasm:build`; to test the generated artifact,
run `npm run wasm:verify`. Developers without Julia 1.12 receive a clear error
before Vite starts, rather than a broken page.

If `predev` stops after "Generating Julia/WASM module", Julia may have failed
or received a fatal signal. The bootstrap script now prints the selected Julia
executable, version, exit code or signal, and a diagnostic before it exits.
If Julia crashes in `Pkg.instantiate()`, first test whether `LD_LIBRARY_PATH`
or `LD_PRELOAD` is interfering: `env -u LD_LIBRARY_PATH -u LD_PRELOAD npm run dev`.
Juliaup 1.12 is the verified compiler, but even that can crash due to local
library conflicts or native runtime bugs. The bootstrap prints the phase
(package resolution versus kernel compilation) before starting it. The project does not
silently fall back to JavaScript if Julia compilation fails.

Open **Experiments → Julia / WASM cobweb**. Change the growth rate and initial
condition, select a trajectory by clicking the plot, then Step/Play/Rewind.

The WasmGC module must load in the target browser. Compilation is performed
during the build, not on each slider change. If the WASM module is absent or
cannot instantiate, the view shows a visible error rather than silently
running JavaScript. In particular, it detects Vite's HTML index fallback for a
missing asset (the `<!doctype html>` response previously caused a confusing
WebAssembly magic-word error).

## Try the verified CI build without compiling Julia locally

A successful **Verify Math Studio** PR workflow now uploads
`julia-wasm-logistic-step`. Download the artifact from the run's **Artifacts**
section and extract `logistic_step.wasm` into `public/julia-wasm/`.

If you use the GitHub CLI, replace `RUN_ID` with the latest successful run:

```sh
mkdir -p public/julia-wasm
gh run download RUN_ID -R gqgs/math-studio -n julia-wasm-logistic-step -D public/julia-wasm
npm run wasm:verify
npm run dev
```

The downloaded module is verified by the existing `wasm:ensure` check.
It is not committed to Git and does not constitute a runtime JavaScript fallback.
This is an escape hatch for testing the PoC while investigating native Julia
crashes, rather than a decision about long-term binary distribution.

## What this proves (and does not)

**Proves, once CI succeeds:** a real Julia function can cross the WasmTarget
→ browser boundary and drive a live numerical visualization within Math Studio.

**Does not yet prove:** compatibility with JuliaDynamics' full algorithm
implementations, arbitrary Julia source input, the SciML ODE solver stack,
WasmMakie, or use of WebGPU for rendering. This first experiment intentionally
renders the results with the existing browser Canvas API.

## Next evaluation

1. Try compiling a selected numerical function directly from JuliaDynamics
   (not merely reproducing its mathematics), with native Julia parity tests.
2. Move to multi-dimensional trajectories using the verified SimpleDiffEq
   + StaticArrays support and send packed samples to Three.js.
3. Measure WASM download size, startup time, and throughput on a parameter sweep.

References: https://github.com/GroupTherapyOrg/WasmTarget.jl and
https://juliadynamics.github.io/DynamicalSystemsDocs.jl/dynamicalsystems/stable/visualizations/
