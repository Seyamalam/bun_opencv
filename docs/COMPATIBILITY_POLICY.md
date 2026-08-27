# Source-independent compatibility policy

This project implements compatible behavior without copying or translating OpenCV source. OpenCV.js may run as a development comparator, but the published package must contain original Rust, TypeScript, tests, fixtures, and documentation.

## Allowed implementation sources

Implementation authors may use algorithm papers, public standards, textbooks they have the right to use, browser specifications, and independently written notes. Public OpenCV.js documentation may establish function names, parameter order, defaults, accepted types, output behavior, and errors.

Running generated inputs through the public OpenCV.js runtime is allowed. Store the input generator in this repository. Do not copy OpenCV test bodies, fixture collections, sample images, comments, constants, lookup tables, control flow, generated bindings, or documentation prose.

## Required provenance

Every parity entry records:

- whether implementation has started;
- specification source links;
- original authorship status;
- the closest OpenCV.js operation;
- known numerical differences.

An operation cannot become `partial` or `implemented` without original-authorship confirmation and at least one specification source. The release check verifies the package-name decision and the source-independent implementation confirmation. It does not require legal counsel or a patent checklist.

## If copied material enters the repository

Stop and identify it. Do not rewrite headers or describe it as MIT-only code. Record the source, version, copyright, license, modifications, and files that contain it. Add the complete required license and notice material to the source tree and npm archive before distributing it. Review nested asset and model licenses separately.

## Product name and claims

WASMosaic is the project's distinctive primary name. OpenCV is a trademark of its owner and appears only in factual compatibility descriptions. This project is independent and is not affiliated with or endorsed by OpenCV.

Performance claims need a published benchmark with the exact OpenCV.js version, browser, device, input, warm-up policy, sample count, and statistic. “Faster” cannot mean one selected input.

Read [the source-backed licensing research](LICENSING_RESEARCH.md) for the legal sources and the limits of this engineering policy.
