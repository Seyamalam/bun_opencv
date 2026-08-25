# Publishing

Only maintainers with npm package access should publish a release. The GitHub workflow expects npm trusted publishing through OpenID Connect. If the npm package has not been connected to the repository, configure that relationship before pushing a release tag.

`npm publish` runs `bun run release:check`. The check currently blocks publication because the working package name, legal review, and per-operation patent review are unresolved. Update [release-clearance.json](release-clearance.json) only after recording the corresponding review. Every partial or implemented parity entry must also carry `patentReview: "reviewed"`.

## First release

1. Confirm that `bun-opencv` is still the intended npm name and that the package page is available.
2. Add the final repository, bugs, homepage, author, and funding fields to `package.json`.
3. Configure npm trusted publishing for `.github/workflows/release.yml`.
4. Protect the default branch and require the CI workflow.
5. Run the release checks below from a clean checkout.

## Release checklist

1. Choose a version under the rules in [VERSIONING.md](VERSIONING.md).
2. Update `package.json`, `[workspace.package].version` in `Cargo.toml`, `parity/manifest.ts`, and `CHANGELOG.md`.
3. Run `bun run parity:write`.
4. Run `bun install --frozen-lockfile` and `bun run check`.
5. Run `bun run release:check`.
6. Run `bun run build`.
7. Inspect the archive with `npm pack --dry-run` and confirm that `THIRD_PARTY_NOTICES.md` is present.
8. Commit the release changes.
9. Create an annotated tag such as `v0.1.0` and push it.

The release workflow checks that the tag, package version, Rust version, parity manifest, and changelog agree. It then publishes with npm provenance.

## Recovery

Do not reuse or overwrite a version already published to npm. Fix the problem, add a changelog entry, and publish a new patch. Use npm deprecation for a bad but non-malicious release. Follow npm's incident process if a release contains secrets or hostile code.
