# Contributing

Small, testable changes are easiest to review. An operation is incomplete until its Rust behavior, TypeScript contract, parity entry, tests, and documentation agree.

## Setup

Install Bun 1.4 or newer and stable Rust with `rustfmt`, `clippy`, and the `wasm32-unknown-unknown` target. Then run:

```sh
bun install
bun run check
bun run build
```

The full check runs formatting, Oxlint, strict TypeScript, Bun tests, Rust tests, parity validation, documentation links, and version validation. The build also runs a smoke test against the emitted WASM binary.

## Add an operation

1. Write the pure Rust implementation and native unit tests.
2. Export a thin wasm-bindgen wrapper with a stable JavaScript name.
3. Add the method to `OpenCvBackend`, `OpenCv`, and the client.
4. Add TypeScript boundary tests without module mocking.
5. Update `src/operations.ts` and `parity/manifest.ts`.
6. Run `bun run parity:write`.
7. Document exact channel, rounding, border, and alpha behavior.
8. Run `bun run check` and `bun run build`.

Do not mark parity as implemented based only on a matching function name. Add reference fixtures or document the missing numeric comparison.

## Style

Rust code must pass `cargo fmt` and Clippy with warnings denied in CI. TypeScript must pass the strict compiler options and every Oxlint anti-slop rule. Prefer named domain contracts, boundary validation, and inference. Do not weaken a rule or add an unchecked cast to silence a finding.

Documentation should state exact behavior and current limits. Avoid claims such as "full OpenCV" unless tests support them.

## Source independence

Read [the compatibility policy](docs/COMPATIBILITY_POLICY.md) before implementing an operation. Do not translate OpenCV source, generated bindings, tests, fixtures, comments, constants, lookup tables, or control flow. Use papers, standards, independently written specifications, and generated differential inputs. Record specification links, authorship, and patent-review status in the parity manifest.

## Changes and releases

Add user-visible work to `CHANGELOG.md`. Maintainers own version changes and npm publishing. Read [the publishing guide](docs/PUBLISHING.md) before preparing a release.
