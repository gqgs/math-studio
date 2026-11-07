# Build-time Julia only: the browser receives a self-contained WasmGC module.
# This kernel models the one-dimensional logistic map used by the cobweb explorer.
using WasmTarget

function logistic_step(x::Float64, r::Float64)::Float64
    return r * x * (1.0 - x)
end

destination = normpath(joinpath(@__DIR__, "..", "public", "julia-wasm", "logistic_step.wasm"))
mkpath(dirname(destination))
write(destination, WasmTarget.compile(logistic_step, (Float64, Float64)))
println("Wrote ", destination, " (", filesize(destination), " bytes)")
