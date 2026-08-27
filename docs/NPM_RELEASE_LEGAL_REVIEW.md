# npm release engineering legal review

Review date: 2026-08-27

This is an engineering due-diligence record, not legal advice or a freedom-to-operate opinion. Patent and trademark rights are territorial, fact-specific, and determined from live claims and legal status. External counsel remains the right reviewer for a commercial release or a legal clearance representation.

## Conclusion

The repository evidence reasonably supports recording **engineering patent review completed** for all 170 currently supported manifest entries, provided `patentReview: "reviewed"` means that the shipped behavior was identified, categorized, and checked for known engineering patent signals. It must not be presented as a representation that no patent can be asserted.

That conclusion rests on the actual shipped scope:

- 82 `features2d` entries only allocate Rust-owned configuration state or get and set configuration values. They do not detect keypoints or compute descriptors.
- 19 `photo` entries only allocate Rust-owned tone-map configuration state or get and set values. They do not process pixels.
- 53 `core` entries are matrix storage, layout, pointwise arithmetic, elementary math, reductions, random-number generation, or linear-algebra primitives.
- 16 `imgproc` entries are basic contour geometry, window and structuring-element construction, transform-matrix construction, grayscale conversion, nearest-neighbor resizing, or binary thresholding.

The count is exhaustive: 82 + 19 + 53 + 16 = 170, matching the non-planned entries in `parity/manifest.ts` at review time. No current entry contains SIFT, SURF, feature detection, descriptor extraction, a tone-mapping processor, a codec, a model, or model weights.

The same evidence does **not** support setting a general `legalReviewCompleted` declaration based only on this document. WIPO defines a freedom-to-operate search as jurisdiction-specific work requiring analysis of claims and legal status, and USPTO guidance states that patent claims define the protected scope. A keyword review and source inspection cannot replace that work. See the [WIPO PATENTSCOPE glossary](https://www.wipo.int/en/web/patentscope/db/help-results), the [WIPO guide to patent information](https://www.wipo.int/edocs/pubdocs/en/wipo-pub-rn2021-1e-en-wipo-guide-to-using-patent-information.pdf), and the [USPTO explanation of claims](https://www.uspto.gov/patents/basics/using-legal-services/pro-se-assistance-program).

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

## Apache's patent grant does not eliminate patent review

Apache 2.0 section 3 grants a patent license only for claims licensable by a contributor that are necessarily infringed by that contributor's contribution, alone or in combination with the work. It is not a warranty that third-party patents do not exist. An independently written package should not assume that the OpenCV contributor grant automatically licenses its separate implementation. See [Apache 2.0 section 3](https://www.apache.org/licenses/LICENSE-2.0) and OpenCV's own [license-change patent discussion](https://github.com/opencv/opencv/wiki/OE-32.--Change-OpenCV-License-to-Apache-2).

OpenCV's discussion expressly says that complete IP cleanliness cannot be guaranteed and that patented algorithms can be difficult to detect. That is why the classifications below use “engineering concern” rather than “patent-free.”

## Review method

The review used four layers:

1. Enumerate every non-planned manifest entry and validate module totals.
2. Inspect Rust and TypeScript exports to determine what each named entry actually performs.
3. Inspect the dry-run npm archive and dependency/notice files for bundled upstream material.
4. Search the official OpenCV 4.13 documentation, WIPO PATENTSCOPE, and USPTO Patent Public Search using the operation and named-algorithm terms, including ORB, FAST, AGAST, GFTT, MSER, KAZE, AKAZE, Drago, Mantiuk, Reinhard, tone mapping, transform, contour, threshold, Hanning, and nearest-neighbor resize.

The patent searches are only a documented engineering screen. WIPO explains that an actual freedom-to-operate search must be country or region specific and must analyze claims and legal status. The USPTO likewise warns that preliminary searches can be incomplete. See [WIPO's definition](https://www.wipo.int/en/web/patentscope/db/help-results), [PATENTSCOPE](https://patentscope.wipo.int/search/en/search.jsf), [USPTO Patent Public Search](https://ppubs.uspto.gov/basic/), and the [USPTO preliminary-search guidance](https://www.uspto.gov/patents/basics/apply).

## Patent-risk classification of all 170 supported entries

“Low” and “low-to-moderate” are engineering triage labels, not legal conclusions.

| Shipped group                                                                     |   Count | Current engineering concern                                 | Reason and required follow-up                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------- | ------: | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features2d` configuration only                                                   |      82 | Low for current shipped behavior; elevated future-work flag | Constructors store parameters; remaining methods return names or get/set primitive state. No detector or descriptor code ships. OpenCV's ORB tutorial expressly describes ORB as not patented, but that statement is not an FTO opinion. KAZE, AKAZE, MSER, FAST, AGAST, and GFTT algorithm kernels require a new claim-level review before implementation. |
| `photo` Tonemap configuration only                                                |      19 | Low for current shipped behavior; elevated future-work flag | The package stores gamma, saturation, bias, scale, intensity, and adaptation values. Drago, Mantiuk, and Reinhard pixel-processing methods do not ship. Each processor requires a new review before implementation.                                                                                                                                         |
| `core` state, data movement, layout, pointwise arithmetic                         |      30 | Low                                                         | These operations manipulate bytes or matrices using elementary state, indexing, arithmetic, comparison, concatenation, channel, and layout behavior. No specific relevant patent was identified in the official-source screen.                                                                                                                              |
| `core` numerical, reduction, random, and linear algebra plus Hanning construction |      24 | Low-to-moderate                                             | These are general mathematical techniques, but a name search cannot rule out implementation-specific claims. Re-review is required before adding specialized codec, hardware, fused, or claimed optimization paths.                                                                                                                                         |
| `imgproc` geometry, transform matrices, and basic image sampling                  |      15 | Low-to-moderate                                             | These are basic contour/coordinate calculations and simple image primitives. No specific relevant patent was identified in the official-source screen. Re-review any materially different or paper-specific algorithm.                                                                                                                                      |
| **Total**                                                                         | **170** | **Engineering review complete**                             | Not a legal FTO conclusion.                                                                                                                                                                                                                                                                                                                                 |

OpenCV's official [ORB tutorial](https://docs.opencv.org/4.13.0/d1/d89/tutorial_py_orb.html) says ORB was designed as an alternative to patented SIFT and SURF and states that ORB itself is not patented. This is useful project evidence, but only patent claims and their current legal status determine enforceable scope.

### Exact group coverage

The 82 `features2d` entries are the complete supported entries under these families:

| Family | Entries | Shipped behavior                                                                            |
| ------ | ------: | ------------------------------------------------------------------------------------------- |
| AKAZE  |      16 | `createAKAZE` plus supported `AKAZE.get*` and `AKAZE.set*` configuration methods            |
| KAZE   |      14 | `createKAZE` plus supported `KAZE.get*` and `KAZE.set*` configuration methods               |
| MSER   |      10 | `createMSER` plus supported `MSER.get*` and `MSER.set*` configuration methods               |
| ORB    |      12 | `createORB` plus supported `ORB.get*` and `ORB.set*` configuration methods                  |
| AGAST  |       8 | `createAgastFeatureDetector` plus supported `AgastFeatureDetector.get*` and `.set*` methods |
| FAST   |       8 | `createFastFeatureDetector` plus supported `FastFeatureDetector.get*` and `.set*` methods   |
| GFTT   |      14 | `createGFTTDetector` plus supported `GFTTDetector.get*` and `.set*` methods                 |

The 19 `photo` entries are `createTonemapDrago`, `createTonemapMantiuk`, `createTonemapReinhard`, the inherited `Tonemap.getGamma` and `Tonemap.setGamma`, and the supported `get*` and `set*` configuration methods on `TonemapDrago`, `TonemapMantiuk`, and `TonemapReinhard`.

The 30 low-concern `core` state/data/layout/pointwise entries are:

`getLogLevel`, `setLogLevel`, `setIdentity`, `lut`, `copyMakeBorder`, `addWeighted`, `convertScaleAbs`, `divide`, `multiply`, `hconcat`, `vconcat`, `absdiff`, `add`, `bitwiseAnd`, `bitwiseNot`, `bitwiseOr`, `bitwiseXor`, `compareEqual`, `countNonZero`, `flip`, `inRange`, `max`, `min`, `repeat`, `rotate`, `subtract`, `transpose`, `merge`, `mixChannels`, and `split`.

The 24 low-to-moderate numerical entries are:

`getOptimalDFTSize`, `randu`, `randn`, `setRNGSeed`, `transform`, `perspectiveTransform`, `determinant`, `invert`, `solve`, `meanStdDev`, `reduce`, `norm`, `normalize`, `cartToPolar`, `exp`, `log`, `magnitude`, `polarToCart`, `pow`, `sqrt`, `mean`, `minMaxLoc`, `trace`, and `createHanningWindow`.

The 15 low-to-moderate geometry/image entries are:

`arcLength`, `contourArea`, `boundingRect`, `isContourConvex`, `pointPolygonTest`, `getStructuringElement`, `ellipse2Poly`, `clipLine`, `getRotationMatrix2D`, `getAffineTransform`, `invertAffineTransform`, `getPerspectiveTransform`, `grayscale`, `resizeNearest`, and `threshold`.

These lists are disjoint and exhaust the 170 supported entries.

## Trademark assessment

OpenCV's terms identify “OpenCV” as a trademark and prohibit use with an unrelated product in a manner likely to confuse consumers. Apache 2.0 also grants no general trademark permission. See the [OpenCV terms](https://opencv.org/university/terms-and-conditions/) and [Apache 2.0 section 6](https://www.apache.org/licenses/LICENSE-2.0).

The new primary npm name `wasmosaic` materially improves the engineering posture because it does not contain the OpenCV mark. Descriptive statements such as “independently compatible with selected OpenCV.js 4.13.0 behavior,” accompanied by a clear non-affiliation disclaimer, are less likely to imply an official OpenCV product than a package name containing `opencv`. Do not use the OpenCV logo, trade dress, or wording such as “official,” “endorsed,” or “OpenCV edition.”

A preliminary exact-term search of the official USPTO, WIPO, and EUIPO indexed sources found no `WASMosaic` result on the review date. That is not a trademark clearance search: spelling variants, similar commercial impressions, common-law use, other jurisdictions, and later filings remain. Counsel or a professional search remains appropriate before major commercial investment.

## npm publishing and provenance

The repository's release workflow uses a GitHub-hosted runner, requests `id-token: write`, and invokes `npm publish --access public --provenance`. npm's official documentation says trusted publishing uses OIDC and automatically produces provenance for public packages from public repositories. It also requires the package repository URL to match the GitHub repository and currently requires npm CLI 11.5.1 or later and Node 22.14.0 or later. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and [npm provenance](https://docs.npmjs.com/generating-provenance-statements/).

The workflow should pin a supported Node/npm toolchain rather than rely on the runner image's incidental npm version. The npm trusted publisher must be configured for the exact repository and `.github/workflows/release.yml` before the tag is pushed.

npm expressly says provenance links an artifact to source and build instructions; it does not guarantee that a package is non-malicious, license-compliant, or patent-cleared. Provenance is a supply-chain control, not legal clearance.

## Remaining release obligations and gates

Engineering evidence supports the following:

- mark per-operation engineering patent review complete for the current 170-entry shipped surface, while preserving this review and its risk tiers;
- keep the source-independent confirmation true only while no upstream material enters the package;
- publish under the distinctive `wasmosaic` name, subject to the non-exhaustive trademark caveat;
- retain the MIT license and third-party dependency notices in the archive;
- keep the OpenCV.js comparator test-only, checksum-pinned, and outside npm;
- use factual compatibility wording and the non-affiliation disclaimer;
- publish from the tagged public GitHub repository using npm trusted publishing/provenance.

The following remain unresolved by engineering review:

- a lawyer's legal review or freedom-to-operate opinion;
- a professional trademark clearance search for `WASMosaic` and desired jurisdictions;
- claim and legal-status analysis for any future KAZE, AKAZE, MSER, FAST, AGAST, GFTT, or tone-mapping algorithm implementation;
- a fresh patent review for future SIMD, GPU, codec, model, fusion, or paper-specific implementations that materially change the current behavior;
- confirmation that every contributor followed the repository's original-authorship policy.

## Decision

For the current code, it is reasonable to say: “This package is an independently authored Rust/TypeScript/WASM implementation of selected public OpenCV.js-compatible behavior. The npm artifact does not ship or link OpenCV. An engineering patent review of all 170 supported entries is complete; no legal freedom-to-operate opinion is claimed.”

It is not reasonable to say: “OpenCV's license proves this rewrite cannot infringe patents,” “Apache 2.0 licenses every independent implementation,” “the project is legally cleared in every country,” or “no patent covers any implementation detail.”
