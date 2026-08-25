# OpenCV parity

This project reimplements OpenCV.js behavior in Rust and TypeScript. It does not compile OpenCV or wrap OpenCV.js.

## Baseline

Full operation parity means the 488 callable families selected by the OpenCV.js 4.13.0 browser configuration across `core`, `imgproc`, `objdetect`, `video`, `dnn`, `features2d`, `photo`, and `calib3d`. The independently authored [inventory](INVENTORY.md) is the checked denominator. The 25% milestone is 122 complete families.

The project pins OpenCV.js 4.13.0. A moving `4.x` branch is useful for discovery but cannot define a reproducible release gate. Callable namespace functions, selected constructors, and selected class methods count here. Constants, enum values, data-only types, basic `Mat` structures, generated vector wrappers, and browser helpers have separate compatibility work but do not change the 488-family denominator.

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

## Working partial families

Nineteen families have useful original Rust/WASM slices. None yet satisfies the full-family definition, so full parity remains 0 of 488.

| Package methods                                       | OpenCV.js families                                                    | Current limit                                |
| ----------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------- |
| `add`, `subtract`, `absdiff`, `min`, `max`            | `cv.add`, `cv.subtract`, `cv.absdiff`, `cv.min`, `cv.max`             | Matching U8 matrix operands                  |
| `bitwiseAnd`, `bitwiseOr`, `bitwiseXor`, `bitwiseNot` | `cv.bitwise_and`, `cv.bitwise_or`, `cv.bitwise_xor`, `cv.bitwise_not` | U8 matrices without scalar or mask forms     |
| `compareEqual`, `inRange`, `countNonZero`             | `cv.compare`, `cv.inRange`, `cv.countNonZero`                         | Selected U8 forms                            |
| `flip`, `repeat`, `rotate`, `transpose`               | `cv.flip`, `cv.repeat`, `cv.rotate`, `cv.transpose`                   | All depths; caller destinations remain       |
| `grayscale`, `resizeNearest`, `threshold`             | `cv.cvtColor`, `cv.resize`, `cv.threshold`                            | One RGBA or luma-derived specialization each |

## Tracked planned sample

The machine-readable implementation ledger tracks `gaussianBlur`, `canny`, `findContours`, and `warpPerspective` as planned examples. The upstream inventory already lists all 488 families. An inventory entry is missing until work starts; it does not need a duplicate planned implementation record.

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

CI rejects stale [generated parity JSON](parity.json). Status values are `implemented`, `partial`, and `planned`. Only `implemented` increments the 488-family parity numerator.
