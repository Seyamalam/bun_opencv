# Performance contract

The package is not faster because it uses Rust. OpenCV.js already runs optimized C++ through WebAssembly. The likely wins come from smaller specialized kernels, fewer copies, reusable memory, fused pipelines, SIMD, and browser-aware scheduling.

## Release targets

The 1.0 target is at least 2x the OpenCV.js geometric mean for warmed 1080p hot kernels and at least 4x for pipelines where this package can keep intermediates in WASM memory. No supported hot kernel should regress by more than 10% without a documented size, precision, or compatibility reason.

These numbers are goals. The project must not describe itself as faster until published benchmark artifacts meet them.

## Reference implementation

Benchmarks compare against the same pinned OpenCV.js release used by the parity ledger. Both libraries receive the same decoded pixels. Decode and network time stay outside operation timing unless a benchmark explicitly measures an end-to-end browser adapter.

## Required cases

- 256 by 256 images for small interactive work;
- 1920 by 1080 images for common camera and video frames;
- 3840 by 2160 images for memory pressure and parallel scheduling;
- one-channel and four-channel matrices where the operation supports both;
- cold initialization and warmed execution;
- scalar WASM, SIMD WASM, and threaded WASM when the browser supports them.

## Measurements

Each report records p50 and p95 elapsed time, warm-up policy, sample count, browser version, CPU, operating system, input type, input dimensions, allocation count, bytes copied across the JavaScript and WASM seam, WASM bytes, and total packed bytes.

Use enough iterations to produce at least one second of measured work per case. Report every case. Do not remove a slow input because it hurts the geometric mean.

## Optimization order

1. Prove numeric parity with differential fixtures.
2. Remove redundant JavaScript and WASM copies.
3. Reuse allocations and keep pipeline intermediates in WASM memory.
4. Measure scalar kernels and fix cache-unfriendly access.
5. Add SIMD for kernels with enough work to repay dispatch.
6. Add workers only when transfer, synchronization, and startup costs are lower than the saved compute time.
7. Consider WebGPU or WebNN for large operations with a measured win and a scalar fallback.

Every optimized implementation must pass the same fixtures as the scalar implementation.
