# OpenCV compatibility licensing research

Research date: 2026-08-25

This note covers an independent Rust, TypeScript, and WebAssembly implementation that aims to match OpenCV.js 4.13.0. It is not legal advice. Copyright, patent, and trademark rules vary by country, and an npm release with commercial ambitions should get a lawyer's review.

## Bottom line

An original Rust implementation can be released under MIT. Matching OpenCV.js behavior does not require copying its C++, generated JavaScript, binding configuration, tests, documentation, or fixtures. That source-independent route gives this project the simplest provenance and the clearest claim that its own code is MIT.

OpenCV 4.13.0 itself is under Apache License 2.0, so copying is permitted, including commercial copying and modification, but the Apache conditions travel with copied or derived material. Copied OpenCV material cannot simply be relabeled as this project's MIT code.

The harder issue is the name. OpenCV states that "OpenCV" is a trademark, and Apache 2.0 does not grant a trademark license beyond reasonable descriptive use. The current package name, `bun-opencv`, puts the mark in the product name. That should receive trademark clearance or permission before publication. A distinctive product name with "OpenCV.js-compatible" used only in descriptive text is the safer posture.

## Verified facts

### The 4.13.0 baseline uses Apache 2.0

OpenCV says releases 4.5.0 and later use Apache License 2.0. The [OpenCV 4.13.0 tag contains the Apache 2.0 license](https://github.com/opencv/opencv/blob/4.13.0/LICENSE) and a separate [copyright file](https://github.com/opencv/opencv/blob/4.13.0/COPYRIGHT). The official [OpenCV license page](https://opencv.org/license/) confirms the version boundary.

Apache 2.0 grants a worldwide, royalty-free copyright license to reproduce, modify, sublicense, and distribute the work and derivative works. It also grants a patent license for contributor patent claims necessarily infringed by the contributor's contribution, subject to the license's patent-litigation termination term. These grants appear in [sections 2 and 3 of the 4.13.0 license](https://github.com/opencv/opencv/blob/4.13.0/LICENSE#L21-L49).

### Copying creates notice duties, not a copyleft duty

When distributing copied or derived OpenCV material, Apache 2.0 section 4 requires the distributor to:

- provide recipients a copy of Apache 2.0;
- mark modified files prominently;
- retain applicable copyright, patent, trademark, and attribution notices in distributed source;
- reproduce applicable attribution notices from an upstream `NOTICE` file if the copied work has one.

Section 4 also permits a distributor to add its own copyright notice and use different terms for its modifications or for a derivative work as a whole, provided the distribution still complies with Apache 2.0. The exact terms are in [OpenCV 4.13.0's license](https://github.com/opencv/opencv/blob/4.13.0/LICENSE#L50-L84).

Apache 2.0 defines source form to include software source, documentation source, and configuration files. Its definition of a derivative work excludes works that remain separable from, or merely link or bind by name to, the licensed work's interfaces. See [section 1](https://github.com/opencv/opencv/blob/4.13.0/LICENSE#L4-L20). This is useful language for an interoperable implementation, but it is a license definition, not a universal court ruling that every API element is outside copyright.

### API names are not the same thing as implementation code

U.S. Copyright Office regulations list names and short phrases as material not subject to copyright. They also distinguish unprotected ideas, methods, and systems from the protected expression used to describe them. See [37 C.F.R. section 202.1](https://www.copyright.gov/title37/202/37cfr202-1.html).

That supports reusing necessary operation names such as `resize`, `Canny`, and `cvtColor`, but it does not settle every question about copying a large API's complete declarations or organization. In _Google LLC v. Oracle America, Inc._, the U.S. Supreme Court assumed for the sake of argument that the copied Java API declarations were copyrightable and decided that Google's particular copying was fair use. The Court did not hold that all APIs are uncopyrightable or that every compatibility project is fair use. See the [official opinion, pages 2 and 20](https://www.supremecourt.gov/opinions/20pdf/593us1r26_f29g.pdf).

The OpenCV.js 4.13.0 binding configuration is a concrete upstream file containing a selected and organized list of modules, classes, methods, constants, and exceptions. The [official configuration](https://github.com/opencv/opencv/blob/4.13.0/platforms/js/opencv_js.config.py) is useful as a factual baseline, but copying the file or translating its structure wholesale is different from implementing individual compatible calls.

### Source, configuration, documentation, tests, and fixtures need separate treatment

The 4.13.0 repository contains OpenCV.js tests for core, matrices, image processing, object detection, video, photo, features, and calibration in the [official JavaScript test directory](https://github.com/opencv/opencv/tree/4.13.0/modules/js/test). Test code, hand-written fixtures, comments, configuration, examples, and documentation can contain copyrightable expression even when the operation's behavior does not.

Apache 2.0 allows those materials to be copied, but doing so invokes its redistribution conditions. A generated WebAssembly or JavaScript build made from OpenCV source is object form under the license and remains covered. Changing the implementation language to Rust does not erase derivation if the Rust code is a translation or close adaptation of OpenCV code.

### The name and logo are a separate trademark question

Apache 2.0 section 6 says the license does not grant permission to use the licensor's trade names, trademarks, service marks, or product names except for reasonable customary use that describes origin or reproduces a `NOTICE`. See [section 6](https://github.com/opencv/opencv/blob/4.13.0/LICENSE#L93-L95).

OpenCV University's [terms state that "OpenCV" is a trademark](https://opencv.org/university/terms-and-conditions/) and say the mark may not be used with another product in a manner likely to confuse consumers. The USPTO explains that confusion can arise when marks have similar sound, appearance, meaning, or commercial impression and the goods or services are related. It recommends a broader clearance search than the federal database alone. See the USPTO pages on [likelihood of confusion](https://www.uspto.gov/trademarks/search/likelihood-confusion) and [federal trademark searching](https://www.uspto.gov/trademarks/search/federal-trademark-searching).

### Apache's patent grant is limited

The Apache patent license reaches only claims that a contributor can license and that the contribution necessarily infringes, alone or in combination with the work to which it was contributed. It does not promise that no third party owns a relevant patent. OpenCV's own licensing proposal says it cannot guarantee complete intellectual-property clearance and identifies patented algorithms as a separate risk. See [Apache 2.0 section 3](https://github.com/opencv/opencv/blob/4.13.0/LICENSE#L37-L49) and [OpenCV's license-change rationale](https://github.com/opencv/opencv/wiki/OE-32.--Change-OpenCV-License-to-Apache-2).

An independent implementation should not assume that OpenCV's contributor patent grant automatically covers separately written Rust code. Whether it does depends on facts and legal interpretation. Algorithms with known or plausible patent history need their own review before implementation and release.

## Cautious recommendations for this project

The items below are engineering policy recommendations, not statements about what the law always requires.

### Keep the shipping implementation source-independent

- Write every CPU, SIMD, threaded, and GPU kernel from algorithm papers, standards, and independently authored specifications. Do not translate OpenCV C++ line by line or preserve its control flow, constants, tables, comments, or optimization layout.
- Use OpenCV.js only as a behavioral oracle in development. Compare outputs through its public runtime API. Do not link OpenCV or ship `opencv.js` in the npm artifact.
- Record provenance per operation. Keep the algorithm source, standards or paper links, upstream API reference, authors, implementation author, and review date in a machine-readable ledger.
- Call this a "source-independent implementation" unless the team actually adopts a formal clean-room process with separate specification and implementation roles. Reading upstream code and later rewriting it is not a clean room merely because the result uses Rust.
- Require contributors to confirm that their patches are original or identify every borrowed part and its license.

Under that policy, the project's original Rust, TypeScript, generated bindings, tests, and docs can stay MIT. Merely listing OpenCV.js as a development comparator should not cause OpenCV code to enter the package. This is the recommended design, not a legal opinion.

### Build an original parity inventory

- Pin the reference to tag `4.13.0` and store the exact tag or commit identifier.
- Extract facts needed for compatibility, such as exported names, parameter order, default values, accepted types, output shape, error behavior, and numerical tolerances.
- Author the project's TypeScript declarations, Rust traits, enums, and module grouping independently. Avoid copying the Python binding configuration or generated declaration blocks as text.
- Keep source links beside inventory entries so reviewers can verify each fact without importing upstream prose.
- Treat a complete verbatim or mechanically translated upstream binding list as Apache-covered material. If the project chooses that shortcut, preserve provenance and notices instead of calling the result solely MIT.

### Write independent differential tests

- Generate deterministic images, matrices, kernels, and edge cases in this repository.
- Run the same generated values through OpenCV.js 4.13.0 and this package, then compare results. Store newly measured expected values only when useful.
- Do not copy OpenCV's test bodies, assertion structure, comments, fixture files, sample images, or golden outputs as a collection.
- Keep OpenCV.js outside the published dependency tree when possible. A CI-only downloaded comparator should have a pinned checksum and a documented license.

This approach tests real compatibility more effectively than porting upstream tests, and it keeps test authorship clear.

### Change or clear the package name before npm publication

- Prefer a distinctive primary name that does not contain `OpenCV`.
- Describe the product factually as "compatible with the OpenCV.js 4.13.0 browser API" or "an independent implementation of selected OpenCV.js behavior."
- Add a plain non-affiliation statement. For example: "OpenCV is a trademark of its owner. This project is independent and is not affiliated with or endorsed by OpenCV."
- Do not use the OpenCV logo, visual identity, or language that suggests an official port, successor, edition, or endorsed replacement.
- Treat the disclaimer as supporting context, not a cure for a confusing product name. Obtain written permission or trademark counsel before publishing as `bun-opencv`.
- Support comparative speed claims with reproducible benchmarks and identify the exact OpenCV.js version, browser, device, warm-up, input, and statistical method.

### Audit patents and third-party components separately

- Add a patent-review field to the parity ledger. Use `unknown`, `reviewed`, `expired`, `licensed`, or `excluded`, with sources and review dates.
- Do not infer patent safety from age, popularity, inclusion in OpenCV, or an open-source license.
- Audit each Rust crate, JavaScript development tool, model, codec, shader, and test asset. GPU or CPU execution does not change the license of copied code.
- Do not ship model weights, cascade files, codecs, or data copied from OpenCV until their file-specific terms have been checked.

### If any OpenCV material is copied after all

Do not hide the reuse. Keep a file-level record and:

1. preserve the original copyright and attribution notices;
2. include the Apache 2.0 text in the distributed npm archive;
3. carry any applicable upstream `NOTICE` content;
4. mark modified files clearly;
5. include OpenCV's `COPYRIGHT` information where it pertains;
6. identify those files as Apache-covered rather than solely MIT;
7. check any nested third-party license before copying;
8. inspect the final `npm pack` contents, not just the Git repository.

Apache 2.0 permits an MIT-licensed larger project, but the exact package metadata and license expression should reflect what the release archive contains. Do not assume that `"license": "MIT"` alone tells recipients about bundled Apache-covered files.

## Release gate

Before the first public npm release, require all of the following:

- no copied OpenCV implementation, generated bundle, configuration, tests, docs, fixtures, models, or images in the archive, unless the Apache path above was deliberately followed;
- provenance and patent-review status for every implemented operation;
- a dependency and asset license report for both Cargo and npm;
- a packed-artifact scan for copyright headers, `OpenCV` source fragments, unexpected binaries, models, and data files;
- trademark clearance or written permission for the final package name;
- a non-affiliation statement and accurate, reproducible parity and performance claims;
- legal review before advertising "full parity" across modules with patented-algorithm history or before using `OpenCV` in the product name.

## Practical decision table

| Planned action                                                               | Recommended treatment                                                                                            |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Match a public function name and parameter order                             | Implement independently and cite the upstream API reference in the parity ledger.                                |
| Match numerical behavior                                                     | Use original generated inputs and a differential runner against pinned OpenCV.js.                                |
| Read OpenCV C++ to understand an edge case                                   | Avoid this for implementation authors when possible. If it happens, document it and require a similarity review. |
| Copy or translate an OpenCV kernel                                           | Treat the result as Apache-covered and perform the section 4 notice work.                                        |
| Copy `opencv_js.config.py` or derive a declaration file mechanically from it | Treat the imported material as Apache-covered, or replace it with an independently authored inventory.           |
| Port an upstream JavaScript test                                             | Preserve Apache obligations and attribution, or write an original test instead.                                  |
| Download OpenCV.js only in CI for comparisons                                | Pin it, document Apache 2.0, keep it out of the npm archive, and verify the packed artifact.                     |
| Publish as `bun-opencv`                                                      | Pause for trademark clearance or permission. A distinctive name is safer.                                        |
| Say the project is faster than OpenCV.js                                     | Publish reproducible evidence and avoid implying endorsement or universal superiority.                           |

## Primary sources

- [OpenCV license page](https://opencv.org/license/)
- [OpenCV 4.13.0 LICENSE](https://github.com/opencv/opencv/blob/4.13.0/LICENSE)
- [OpenCV 4.13.0 COPYRIGHT](https://github.com/opencv/opencv/blob/4.13.0/COPYRIGHT)
- [OpenCV.js 4.13.0 binding configuration](https://github.com/opencv/opencv/blob/4.13.0/platforms/js/opencv_js.config.py)
- [OpenCV.js 4.13.0 test directory](https://github.com/opencv/opencv/tree/4.13.0/modules/js/test)
- [OpenCV license-change proposal and patent discussion](https://github.com/opencv/opencv/wiki/OE-32.--Change-OpenCV-License-to-Apache-2)
- [Apache License 2.0 from the Apache Software Foundation](https://www.apache.org/licenses/LICENSE-2.0)
- [37 C.F.R. section 202.1 from the U.S. Copyright Office](https://www.copyright.gov/title37/202/37cfr202-1.html)
- [Google LLC v. Oracle America, Inc., official U.S. Supreme Court opinion](https://www.supremecourt.gov/opinions/20pdf/593us1r26_f29g.pdf)
- [USPTO likelihood-of-confusion guidance](https://www.uspto.gov/trademarks/search/likelihood-confusion)
- [USPTO federal trademark search guidance](https://www.uspto.gov/trademarks/search/federal-trademark-searching)
