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
