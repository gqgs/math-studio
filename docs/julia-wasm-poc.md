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
julia --project=julia-wasm -e 'using Pkg; Pkg.instantiate()'
npm ci
npm run wasm:build
npm run wasm:verify
npm test
npm run build
npm run dev
```

Open **Experiments → Julia / WASM cobweb**. Change the growth rate and initial
condition, select a trajectory by clicking the plot, then Step/Play/Rewind.

The WasmGC module must load in the target browser. Compilation is performed
during the build, not on each slider change. If the WASM module is absent or
cannot instantiate, the view shows a visible error rather than silently
running JavaScript.

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
