# OpenCV parity

This project reimplements OpenCV.js behavior in Rust and TypeScript. It does not compile OpenCV or wrap OpenCV.js.

## Baseline

Full parity means the public browser bindings selected by the OpenCV.js 4.x binding configuration. The upstream configuration currently includes `core`, `imgproc`, `objdetect`, `video`, `dnn`, `features2d`, `photo`, and `calib3d`.

The project pins OpenCV.js 4.13.0. A moving `4.x` branch is useful for discovery but cannot define a reproducible release gate. The independently authored inventory must cover functions, classes, methods, overloads, enums, and constants in that browser release without copying or mechanically translating its organized binding configuration.

Desktop modules that the official OpenCV.js build disables are outside this parity denominator. This includes `highgui`, `videoio`, and `imgcodecs`. Browser-native image decoding, WebCodecs, WebRTC camera input, workers, and canvas conversion belong to a separate adapter ledger. Those adapters can make this package more useful than OpenCV.js without pretending a browser is a desktop process.

## Module status

| OpenCV.js module | Status      | Next dependency                                     |
| ---------------- | ----------- | --------------------------------------------------- |
| core             | Partial     | Typed `Mat`, arithmetic, reductions, transforms     |
| imgproc          | Partial     | Color conversion, interpolation, convolution        |
| objdetect        | Not started | Core matrices, features, model loading              |
| video            | Not started | Core matrices, pyramids, motion kernels             |
| dnn              | Not started | Tensor storage, model parser, execution planner     |
| features2d       | Not started | Gradients, pyramids, descriptors                    |
| photo            | Not started | Filters, transforms, numerical solvers              |
| calib3d          | Not started | Matrix algebra, feature matching, numerical solvers |

## Implemented

| Package method  | Closest OpenCV operation              | Current limit                                   |
| --------------- | ------------------------------------- | ----------------------------------------------- |
| `grayscale`     | `cv::cvtColor` with `COLOR_RGBA2GRAY` | Fixed RGBA input and fixed-point BT.601 weights |
| `invert`        | `cv::bitwise_not`                     | RGB inversion only; alpha is preserved          |
| `resizeNearest` | `cv::resize` with `INTER_NEAREST`     | RGBA and nearest-neighbor only                  |
| `threshold`     | `cv::threshold` with `THRESH_BINARY`  | Luma-derived binary threshold only              |

## Tracked planned sample

The machine-readable ledger currently tracks `cvtColor`, `gaussianBlur`, `canny`, `findContours`, and `warpPerspective` as planned. This short ledger exists to validate the package machinery. Independently authoring the full pinned inventory is the next parity task.

## Definition of done

An operation counts as implemented only when all of these statements are true:

1. Rust implements every tracked overload for the pinned baseline.
2. Strict TypeScript describes inputs, outputs, errors, defaults, and ownership.
3. Differential fixtures compare results with the pinned OpenCV.js build.
4. Integer results match exactly. Floating-point operations declare and enforce a tolerance.
5. Tests cover empty, invalid, non-contiguous, and aliased inputs where the upstream operation accepts them.
6. The scalar WASM implementation runs in supported browsers.
7. SIMD and threaded implementations fall back without changing results.
8. The README, reference documentation, generated ledger, and package exports agree.

Performance does not decide parity. A slower correct implementation may count as parity, but it cannot satisfy the package's performance release gate.

## Update the ledger

1. Add the Rust export and its unit tests.
2. Add the TypeScript method, backend contract, and tests.
3. Add the operation to `src/operations.ts`.
4. Change or add the matching entry in `parity/manifest.ts`.
5. Run `bun run parity:write`.
6. Document numeric differences in this file.
7. Add the README parity row.
8. Run `bun run parity:check`.

CI rejects stale [generated parity JSON](parity.json). Status values are `implemented` and `planned`.
