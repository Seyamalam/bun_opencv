# Versioning

The npm package follows Semantic Versioning.

- A patch fixes behavior without changing documented inputs or outputs.
- A minor adds operations, overloads, or optional capabilities without breaking existing callers.
- A major removes or changes documented API behavior.

Before 1.0.0, the project may make breaking changes in a minor release. Each such change must appear under a `Changed` heading in the changelog. Patch releases remain backward compatible.

The version appears in three checked sources: `package.json`, the Cargo workspace package metadata, and `parity/manifest.ts`. The changelog must also contain a heading for that version. `bun run version:check` fails if they disagree.

## Version history

| Version | Date       | Summary                                                                    |
| ------- | ---------- | -------------------------------------------------------------------------- |
| 0.1.0   | 2026-08-25 | Initial Rust, WASM, TypeScript, validation, and parity-checking foundation |

The detailed record lives in [CHANGELOG.md](../CHANGELOG.md).
