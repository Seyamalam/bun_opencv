# Changelog

This file records user-visible changes. The format follows Keep a Changelog, and versions follow Semantic Versioning as described in [the versioning policy](docs/VERSIONING.md).

## [Unreleased]

### Planned

- Define full parity against a pinned OpenCV.js browser-binding inventory.
- Build the typed `Mat`, differential test, and browser benchmark foundations.
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
