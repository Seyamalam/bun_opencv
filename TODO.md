# TODO

The roadmap gives release order. This file lists concrete work that can be picked up now.

## Before the first npm publish

- [ ] Confirm the npm package name.
- [ ] Replace the `OWNER` placeholders in `CHANGELOG.md` after creating the repository.
- [ ] Add repository, homepage, bugs, author, and funding metadata to `package.json`.
- [ ] Configure npm trusted publishing for the release workflow.
- [ ] Run the package in Vite, webpack, and a direct browser import-map fixture.
- [ ] Record supported browser versions from those results.
- [ ] Review the package archive produced by `npm pack --dry-run`.

## Correctness

- [x] Pin OpenCV.js 4.13.0 as the compatibility reference.
- [x] Independently author the 488-family browser binding inventory without copying its organized configuration.
- [x] Add unsigned 8-bit Rust `Mat` storage with channels, dimensions, stride, and zero-copy regions of interest.
- [x] Add deterministic TypeScript disposal for WASM matrix handles.
- [x] Add signed integer and floating-point matrix depths.
- [ ] Add reusable output buffers and in-WASM operation pipelines.
- [ ] Add differential fixtures for all 19 partial operation families.
- [ ] Pin the exact OpenCV reference version used to create fixtures.
- [ ] Decide whether grayscale should match OpenCV's integer rounding byte for byte.
- [ ] Add fuzz or property tests for dimensions, buffer lengths, and resize mappings.

## Performance

- [ ] Build the OpenCV.js comparison harness for 256 by 256, 1080p, and 4K inputs.
- [ ] Record p50, p95, allocation count, seam copies, WASM bytes, and packed bytes.
- [ ] Re-enable wasm-pack's `wasm-opt` pass after its bundled Binaryen supports current Rust bulk-memory output.
- [ ] Benchmark allocation and copy costs on one small and one large image.
- [ ] Measure scalar WASM before adding SIMD.
- [ ] Design reusable output buffers only after profiling real browser calls.
- [ ] Publish bundle and WASM byte sizes in CI.

## API work

- [ ] Decide how asynchronous worker execution should report cancellation.
- [ ] Specify border modes before adding convolution.
- [ ] Specify channel order and output format for general color conversion.
- [ ] Add operation-specific parity fixtures before marking another entry implemented.
