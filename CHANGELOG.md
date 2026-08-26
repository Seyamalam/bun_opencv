# Changelog

This file records user-visible changes. The format follows Keep a Changelog, and versions follow Semantic Versioning as described in [the versioning policy](docs/VERSIONING.md).

## [Unreleased]

### Added

- Independent inventory of 488 OpenCV.js 4.13.0 callable browser families with a checked 122-family target for 25% parity.
- Rust-owned matrices for U8, I8, U16, I16, I32, F32, and F64 with typed JavaScript factories and compact ROI exports.
- Twelve U8 matrix core slices: saturating arithmetic, absolute difference, bitwise operations, minimum, maximum, equality comparison, inclusive range masks, and non-zero reduction.
- All-depth matrix flip, transpose, rotation, and repeat operations with strided-region handling.
- All-depth count, sum, mean, extrema-location, and trace reductions with explicit NaN rules.
- All-depth identity, uniform random, and normal random matrix fills with reproducible package-owned seed control.
- Package-owned log-level state and 2-, 3-, and 5-smooth DFT size planning utilities.
- Per-element linear, affine, and perspective transforms with allocating and mutable destination forms.
- Dense determinant, inverse, and linear-system solvers with LU, Cholesky, and QR methods.
- Contour measurement, bounds, convexity, and signed point-to-polygon queries for I32, F32, and F64 point matrices.
- Structuring-element, Hanning-window, ellipse-polyline, and line-clipping helpers.
- Affine, inverse-affine, rotation, and perspective transform matrix constructors with F64 output.
- Alias-safe single-source `mixChannels` routing across all scalar depths.
- Sixteen partial AKAZE configuration families with typed defaults, validated Rust-owned state, and deterministic disposal, bringing the supported partial total to 85.
- Sixteen partial AGAST and FAST configuration families with signed 32-bit thresholds, typed detector modes, deterministic disposal, and browser-checked state mutation, bringing the supported partial total to 101.
- Fourteen partial KAZE configuration families with typed diffusivity, finite signed thresholds, deterministic disposal, and browser-checked state mutation, bringing the supported partial total to 115.
- One partial GFTT factory family and 13 fully implemented GFTT detector instance methods, bringing the totals to 116 partial, 13 implemented, and 129 supported families.
- A comprehensive pinned-browser GFTT matrix for exact arity, return values, scalar coercion, argument errors, deletion, repeat deletion, and calls after deletion.
- OpenCV.js-compatible `BindingError` identity and GFTT `delete()` lifecycle behavior, while retaining idempotent `dispose()` as a package convenience.
- Ten fully implemented primitive AGAST and FAST instance methods with exact arity, return values, scalar coercion, `BindingError` argument checks, and deletion behavior, bringing the totals to 106 partial, 23 implemented, and 129 supported families.
- Eleven fully implemented non-enum KAZE instance methods with exact arity, complete signed i32, F64, and boolean coercion, `BindingError` argument checks, and deletion behavior, bringing the totals to 95 partial, 34 implemented, and 129 supported families.
- Eleven fully implemented non-enum AKAZE instance methods with exact arity, complete signed i32 and F64 coercion, `BindingError` argument checks, and deletion behavior, bringing the totals to 84 partial, 45 implemented, and 129 supported families.
- OpenCV.js-compatible negative-input and upper-sentinel behavior for `getOptimalDFTSize`, plus a fail-closed numeric browser comparator for enum-backed values.
- A fully implemented `getOptimalDFTSize` family with exact arity, Embind signed i32 coercion and errors, exhaustive smooth-size boundary tests, and the pinned upper sentinel, bringing the totals to 83 partial, 46 implemented, and 129 supported families.
- Ten fully implemented enum-backed detector methods across AKAZE, KAZE, AGAST, and FAST. Their browser contract covers enum namespace descriptors, canonical and shared singleton identity, structural setter coercion, unknown signed i32 wire values, exact arity, and lifetime errors. The totals are now 73 partial, 56 implemented, and 129 supported families; detector factories remain partial.
- A fully implemented `transpose` family with exact two-argument calls, all scalar depths, OutputArray reallocation, empty and deleted matrices, in-place shapes, detached incompatible regions, and OpenCV-compatible overlapping aliases. The totals are now 72 partial, 57 implemented, and 129 supported families.
- A fully implemented `flip` family with exact three-argument calls, Embind signed-int conversion, all scalar depths, empty and deleted matrices, OutputArray reallocation, and live shared-region alias behavior. The totals are now 71 partial, 58 implemented, and 129 supported families.
- A fully implemented `countNonZero` family with exact one-argument calls, all seven scalar depths, empty matrices, non-contiguous regions, floating-point edge values, invalid inputs, and deleted-handle behavior. The totals are now 70 partial, 59 implemented, and 129 supported families.
- A fully implemented `repeat` family with exact four-argument calls, Embind signed-int conversion, all scalar depths, empty and deleted matrices, OutputArray replacement, exact in-place rejection, and live shared-region alias behavior. The totals are now 69 partial, 60 implemented, and 129 supported families.
- A fully implemented `rotate` family with exact three-argument calls and constants, Embind signed-int conversion, all scalar depths, empty and deleted matrices, OutputArray replacement, valid in-place operation, and live shared-region alias behavior. The totals are now 68 partial, 61 implemented, and 129 supported families.
- Strict TypeScript matrix APIs and WASM adapters for the new depths and operations.

### Planned

- Build differential-test and browser-benchmark foundations against the pinned baseline.
- Complete the remaining overloads and depth forms for every partial core family.
- Add browser differential tests against trusted image fixtures.
- Reduce buffer copies after benchmark data justifies an ownership model.

## [0.1.0] - 2026-08-25

### Added

- Rust-owned unsigned 8-bit matrices with explicit disposal and zero-copy regions of interest.
- Source-independent implementation policy, per-operation provenance fields, third-party notices, and a publication clearance gate.
- Rust implementations for RGBA grayscale, invert, binary threshold, and nearest-neighbor resize.
- A strict TypeScript API with browser `ImageData` conversion helpers.
- A wasm-pack browser build and npm export map.
- Rust and TypeScript unit tests.
- Oxlint with the complete local anti-slop rule set.
- Generated JSON and human-readable OpenCV parity ledgers.
- CI, npm provenance release automation, documentation checks, and version consistency checks.

[Unreleased]: https://github.com/OWNER/bun-opencv/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/OWNER/bun-opencv/releases/tag/v0.1.0
