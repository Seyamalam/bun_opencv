# OpenCV license and implementation review

Review date: 2026-08-27

This is the project's engineering record. It checks what the package ships, where the implementation came from, and which OpenCV license terms matter. It is not a legal opinion, and it is not an npm publication gate.

## Conclusion

The repository evidence supports publishing the current 170 supported entries as independently implemented code. The package does not ship OpenCV code, link to OpenCV, or bundle the OpenCV.js comparator.

That conclusion rests on the actual shipped scope:

- 82 `features2d` entries only allocate Rust-owned configuration state or get and set configuration values. They do not detect keypoints or compute descriptors.
- 19 `photo` entries only allocate Rust-owned tone-map configuration state or get and set values. They do not process pixels.
- 53 `core` entries are matrix storage, layout, pointwise arithmetic, elementary math, reductions, random-number generation, or linear-algebra primitives.
- 16 `imgproc` entries are basic contour geometry, window and structuring-element construction, transform-matrix construction, grayscale conversion, nearest-neighbor resizing, or binary thresholding.

The count is exhaustive: 82 + 19 + 53 + 16 = 170, matching the non-planned entries in `parity/manifest.ts` at review time. No current entry contains SIFT, SURF, feature detection, descriptor extraction, a tone-mapping processor, a codec, a model, or model weights.

The project does not claim that open source status creates immunity from third-party rights. It also does not require a legal opinion or patent checklist before publishing original code.

## Is this an independent rewrite?

The inspected repository and packed artifact are consistent with a source-independent Rust and TypeScript rewrite, not a wrapper around or distribution of OpenCV:

- the Rust crate depends on `wasm-bindgen` and `console_error_panic_hook`, not OpenCV;
- the TypeScript package imports the package's generated WebAssembly, not `opencv.js`;
- configuration modules explicitly state that feature detection, descriptor computation, and tone-map processing are absent;
- the compatibility policy forbids translating OpenCV kernels, control flow, tables, tests, binding configuration, documentation prose, fixtures, or generated bundles;
- each supported manifest entry records `implementationOrigin: "original"` and a project-authored scope note;
- the OpenCV.js 4.13.0 reference is a development-only black-box comparator downloaded from the official documentation URL with a pinned SHA-256 digest;
- the comparator cache is gitignored, and `npm pack --dry-run --ignore-scripts --json` did not include the comparator, browser differential tests, OpenCV source, models, sample data, or fixtures;
- a string scan of the generated WebAssembly found Rust source paths and generated binding names, but no OpenCV copyright, license, or implementation notice.

These are strong engineering provenance signals. They do not prove authorship mathematically or substitute for a forensic source-similarity audit. Any contributor who copied or translated upstream material contrary to policy would change the conclusion.

## OpenCV and Apache 2.0

OpenCV 4.13.0 carries the Apache License 2.0 in its tagged repository and a separate upstream copyright file. OpenCV's official license page states that OpenCV 4.5.0 and later are Apache 2.0. See the [OpenCV 4.13.0 LICENSE](https://github.com/opencv/opencv/blob/4.13.0/LICENSE), [OpenCV 4.13.0 COPYRIGHT](https://github.com/opencv/opencv/blob/4.13.0/COPYRIGHT), [license-change notice](https://github.com/opencv/opencv/blob/4.13.0/doc/LICENSE_CHANGE_NOTICE.txt), and [OpenCV license page](https://opencv.org/license/).

Apache 2.0 grants copyright permission to reproduce, modify, sublicense, and distribute the licensed work. Its definition of derivative works excludes works that remain separable from, or merely link or bind by name to, interfaces. When Apache-covered material is distributed, section 4 requires a license copy, modified-file notices, retention of applicable notices, and reproduction of an applicable upstream `NOTICE`. Section 6 does not grant a trademark license beyond reasonable customary use that describes origin or reproduces a notice. See the official [Apache License 2.0 text](https://www.apache.org/licenses/LICENSE-2.0).

On the inspected facts, matching public runtime behavior through original code does not place OpenCV code into the npm package. Therefore, OpenCV's Apache redistribution conditions do not appear to be triggered by the shipping implementation itself. The downloaded comparator remains OpenCV's Apache-covered object code while it is used in development. If it is ever committed, mirrored, bundled, or published, its Apache license and applicable notices must travel with it.

Changing the implementation language would not cure copying. A Rust translation of an OpenCV kernel, test, configuration file, table, comment, or generated binding would still require a separate derivation and notice analysis. This review reaches its conclusion because the project policy and inspected artifact indicate behavioral comparison without such material.

## Apache patent clause

Apache 2.0 section 3 contains a contributor patent grant with defined limits. That clause does not turn this project into OpenCV code, and the project does not use patent review as a publication gate. See the official [Apache License 2.0 text](https://www.apache.org/licenses/LICENSE-2.0).

## Trademark assessment

OpenCV's terms identify """OpenCV""" as a trademark and prohibit use with an unrelated product in a manner likely to confuse consumers. Apache 2.0 also grants no general trademark permission. See the [OpenCV terms](https://opencv.org/university/terms-and-conditions/) and [Apache 2.0 section 6](https://www.apache.org/licenses/LICENSE-2.0).

The new primary npm name `wasmosaic` materially improves the engineering posture because it does not contain the OpenCV mark. Descriptive statements such as """independently compatible with selected OpenCV.js 4.13.0 behavior,""" accompanied by a clear non-affiliation disclaimer, are less likely to imply an official OpenCV product than a package name containing `opencv`. Do not use the OpenCV logo, trade dress, or wording such as """official,""" """endorsed,""" or """OpenCV edition."""

A preliminary exact-term search of the official USPTO, WIPO, and EUIPO indexed sources found no `WASMosaic` result on the review date. That is not a trademark clearance search: spelling variants, similar commercial impressions, common-law use, other jurisdictions, and later filings remain. Counsel or a professional search remains appropriate before major commercial investment.

## npm publishing and provenance

The repository's release workflow uses a GitHub-hosted runner, requests `id-token: write`, and invokes `npm publish --access public --provenance`. npm's official documentation says trusted publishing uses OIDC and automatically produces provenance for public packages from public repositories. It also requires the package repository URL to match the GitHub repository and currently requires npm CLI 11.5.1 or later and Node 22.14.0 or later. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and [npm provenance](https://docs.npmjs.com/generating-provenance-statements/).

The workflow should pin a supported Node/npm toolchain rather than rely on the runner image's incidental npm version. The npm trusted publisher must be configured for the exact repository and `.github/workflows/release.yml` before the tag is pushed.

npm expressly says provenance links an artifact to source and build instructions; it does not guarantee that a package is non-malicious, license-compliant, or patent-cleared. Provenance is a supply-chain control, not legal clearance.

## Release controls

Engineering evidence supports the following:

- keep the source-independent confirmation true only while no upstream material enters the package;
- publish under the distinctive `wasmosaic` name, subject to the non-exhaustive trademark caveat;
- retain the MIT license and third-party dependency notices in the archive;
- keep the OpenCV.js comparator test-only, checksum-pinned, and outside npm;
- use factual compatibility wording and the non-affiliation disclaimer;
- publish from the tagged public GitHub repository using npm trusted publishing/provenance.

## Decision

For the current code, it is accurate to say: "This package is an independently authored Rust, TypeScript, and WebAssembly implementation of selected public OpenCV.js-compatible behavior. The npm artifact does not ship or link OpenCV."

It is not reasonable to say: """OpenCV's license proves this rewrite cannot infringe patents,""" """Apache 2.0 licenses every independent implementation,""" """the project is legally cleared in every country,""" or """no patent covers any implementation detail."""
