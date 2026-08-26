# OpenCV parity

This project reimplements OpenCV.js behavior in Rust and TypeScript. It does not compile OpenCV or wrap OpenCV.js.

## Baseline

Full operation parity means the 488 callable families selected by the OpenCV.js 4.13.0 browser configuration across `core`, `imgproc`, `objdetect`, `video`, `dnn`, `features2d`, `photo`, and `calib3d`. The independently authored [inventory](INVENTORY.md) is the checked denominator. The 25% milestone is 122 complete families.

The project pins OpenCV.js 4.13.0. A moving `4.x` branch is useful for discovery but cannot define a reproducible release gate. Callable namespace functions, selected constructors, and selected class methods count here. Constants, enum values, data-only types, basic `Mat` structures, generated vector wrappers, and browser helpers have separate compatibility work but do not change the 488-family denominator.

Desktop modules that the official OpenCV.js build disables are outside this parity denominator. This includes `highgui`, `videoio`, and `imgcodecs`. Browser-native image decoding, WebCodecs, WebRTC camera input, workers, and canvas conversion belong to a separate adapter ledger. Those adapters can make this package more useful than OpenCV.js without pretending a browser is a desktop process.

## Module status

| OpenCV.js module | Status      | Next dependency                                             |
| ---------------- | ----------- | ----------------------------------------------------------- |
| core             | Partial     | Typed `Mat`, arithmetic, reductions, transforms             |
| imgproc          | Partial     | Color conversion, interpolation, convolution                |
| objdetect        | Not started | Core matrices, features, model loading                      |
| video            | Not started | Core matrices, pyramids, motion kernels                     |
| dnn              | Not started | Tensor storage, model parser, execution planner             |
| features2d       | Partial     | Configuration only; gradients, pyramids, descriptors remain |
| photo            | Not started | Filters, transforms, numerical solvers                      |
| calib3d          | Not started | Matrix algebra, feature matching, numerical solvers         |

## Working partial families

One hundred twenty-nine families have useful original Rust/WASM slices. None yet satisfies the full-family definition, so full parity remains 0 of 488.

| Package methods                                                                                                  | OpenCV.js families                                                    | Current limit                                            |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| `add`, `subtract`, `absdiff`, `min`, `max`                                                                       | `cv.add`, `cv.subtract`, `cv.absdiff`, `cv.min`, `cv.max`             | Matching U8 matrix operands                              |
| `bitwiseAnd`, `bitwiseOr`, `bitwiseXor`, `bitwiseNot`                                                            | `cv.bitwise_and`, `cv.bitwise_or`, `cv.bitwise_xor`, `cv.bitwise_not` | U8 matrices without scalar or mask forms                 |
| `compareEqual`, `inRange`, `countNonZero`                                                                        | `cv.compare`, `cv.inRange`, `cv.countNonZero`                         | Selected U8 forms                                        |
| `flip`, `repeat`, `rotate`, `transpose`                                                                          | `cv.flip`, `cv.repeat`, `cv.rotate`, `cv.transpose`                   | All depths and mutable destinations                      |
| `split`, `merge`                                                                                                 | `cv.split`, `cv.merge`                                                | All depths; selected array call forms                    |
| `hconcat`, `vconcat`                                                                                             | `cv.hconcat`, `cv.vconcat`                                            | All depths; two through four inputs                      |
| `exp`, `log`, `sqrt`, `pow`, `magnitude`                                                                         | Matching `cv` floating-point families                                 | F32/F64; selected return forms                           |
| `cartToPolar`, `polarToCart`                                                                                     | `cv.cartToPolar`, `cv.polarToCart`                                    | F32/F64 with mutable paired outputs                      |
| `multiply`, `divide`, `addWeighted`, `convertScaleAbs`                                                           | Matching `cv` numeric families                                        | All depths; selected matrix forms                        |
| `copyMakeBorder`                                                                                                 | `cv.copyMakeBorder`                                                   | All depths and five border modes                         |
| `lut`                                                                                                            | `cv.LUT`                                                              | Byte sources and every table depth                       |
| `norm`, `normalize`                                                                                              | `cv.norm`, `cv.normalize`                                             | All depths, masks, and major norm modes                  |
| `meanStdDev`, `reduce`                                                                                           | `cv.meanStdDev`, `cv.reduce`                                          | All depths and mutable outputs                           |
| `mean`, `minMaxLoc`, `trace`                                                                                     | `cv.mean`, `cv.minMaxLoc`, `cv.trace`                                 | Masks or multi-channel trace remain                      |
| `mixChannels`                                                                                                    | `cv.mixChannels`                                                      | One source and destination; MatVector remains            |
| `setIdentity`, `randu`, `randn`, `setRNGSeed`                                                                    | Matching `cv` initialization and random families                      | Package RNG sequences differ from OpenCV                 |
| `getLogLevel`, `setLogLevel`, `getOptimalDFTSize`                                                                | Matching `cv` runtime utility families                                | DFT browser fixtures pass; logs absent upstream artifact |
| `transform`, `perspectiveTransform`                                                                              | `cv.transform`, `cv.perspectiveTransform`                             | Selected channel and coefficient forms                   |
| `determinant`, `invert`, `solve`                                                                                 | `cv.determinant`, `cv.invert`, `cv.solve`                             | Selected dense single-channel methods                    |
| `arcLength`, `contourArea`, `boundingRect`                                                                       | Matching `cv` contour geometry families                               | I32/F32/F64 2D contour layouts                           |
| `isContourConvex`, `pointPolygonTest`                                                                            | Matching `cv` polygon-query families                                  | Convexity, classification, or signed distance            |
| `getStructuringElement`, `createHanningWindow`                                                                   | Matching `cv` kernel and window families                              | U8 kernels or F32/F64 windows                            |
| `ellipse2Poly`, `clipLine`                                                                                       | Matching `cv` integer geometry helpers                                | Selected integer argument and return forms               |
| `getRotationMatrix2D`, `getAffineTransform`                                                                      | Matching `cv` affine matrix constructors                              | Selected finite inputs with F64 output                   |
| `invertAffineTransform`, `getPerspectiveTransform`                                                               | Matching `cv` transform matrix families                               | Selected F32/F64 inputs with F64 output                  |
| `createAKAZE`, `AKAZE.getDefaultName`                                                                            | `cv.AKAZE.create`, `cv.AKAZE.getDefaultName`                          | Owned configuration only; detection remains              |
| `AKAZE.getDescriptorChannels`, `AKAZE.getDescriptorSize`, `AKAZE.getDescriptorType`                              | Matching `cv.AKAZE` descriptor getters                                | Validated configuration state only                       |
| `AKAZE.getDiffusivity`, `AKAZE.getNOctaveLayers`, `AKAZE.getNOctaves`, `AKAZE.getThreshold`                      | Matching `cv.AKAZE` detector getters                                  | Validated configuration state only                       |
| `AKAZE.setDescriptorChannels`, `AKAZE.setDescriptorSize`, `AKAZE.setDescriptorType`                              | Matching `cv.AKAZE` descriptor setters                                | Atomic configuration mutation only                       |
| `AKAZE.setDiffusivity`, `AKAZE.setNOctaveLayers`, `AKAZE.setNOctaves`, `AKAZE.setThreshold`                      | Matching `cv.AKAZE` detector setters                                  | Atomic configuration mutation only                       |
| `createKAZE`, `KAZE.getDefaultName`                                                                              | `cv.KAZE.create`, `cv.KAZE.getDefaultName`                            | Owned configuration only; detection remains              |
| `KAZE.getDiffusivity`, `KAZE.getExtended`, `KAZE.getNOctaveLayers`, `KAZE.getNOctaves`                           | Matching `cv.KAZE` configuration getters                              | Rust-owned configuration state only                      |
| `KAZE.getThreshold`, `KAZE.getUpright`                                                                           | Matching `cv.KAZE` detector and descriptor getters                    | Finite threshold and boolean state only                  |
| `KAZE.setDiffusivity`, `KAZE.setExtended`, `KAZE.setNOctaveLayers`, `KAZE.setNOctaves`                           | Matching `cv.KAZE` configuration setters                              | Validated configuration mutation only                    |
| `KAZE.setThreshold`, `KAZE.setUpright`                                                                           | Matching `cv.KAZE` detector and descriptor setters                    | Atomic configuration mutation only                       |
| `createAgastFeatureDetector`, `AgastFeatureDetector.getDefaultName`                                              | Matching `cv.AgastFeatureDetector` factory and name families          | Owned configuration only; detection remains              |
| `AgastFeatureDetector.getNonmaxSuppression`, `AgastFeatureDetector.getThreshold`, `AgastFeatureDetector.getType` | Matching `cv.AgastFeatureDetector` getters                            | Rust-owned configuration state only                      |
| `AgastFeatureDetector.setNonmaxSuppression`, `AgastFeatureDetector.setThreshold`, `AgastFeatureDetector.setType` | Matching `cv.AgastFeatureDetector` setters                            | Validated configuration mutation only                    |
| `createFastFeatureDetector`, `FastFeatureDetector.getDefaultName`                                                | Matching `cv.FastFeatureDetector` factory and name families           | Owned configuration only; detection remains              |
| `FastFeatureDetector.getNonmaxSuppression`, `FastFeatureDetector.getThreshold`, `FastFeatureDetector.getType`    | Matching `cv.FastFeatureDetector` getters                             | Rust-owned configuration state only                      |
| `FastFeatureDetector.setNonmaxSuppression`, `FastFeatureDetector.setThreshold`, `FastFeatureDetector.setType`    | Matching `cv.FastFeatureDetector` setters                             | Validated configuration mutation only                    |
| `createGFTTDetector`, `GFTTDetector.getDefaultName`                                                              | Matching `cv.GFTTDetector` factory and name families                  | Owned configuration only; detection remains              |
| `GFTTDetector.getBlockSize`, `GFTTDetector.getHarrisDetector`, `GFTTDetector.getK`                               | Matching `cv.GFTTDetector` configuration getters                      | Rust-owned configuration state only                      |
| `GFTTDetector.getMaxFeatures`, `GFTTDetector.getMinDistance`, `GFTTDetector.getQualityLevel`                     | Matching `cv.GFTTDetector` detector getters                           | Signed and non-finite values preserved                   |
| `GFTTDetector.setBlockSize`, `GFTTDetector.setHarrisDetector`, `GFTTDetector.setK`                               | Matching `cv.GFTTDetector` configuration setters                      | Configuration mutation only                              |
| `GFTTDetector.setMaxFeatures`, `GFTTDetector.setMinDistance`, `GFTTDetector.setQualityLevel`                     | Matching `cv.GFTTDetector` detector setters                           | Signed and non-finite values preserved                   |
| `grayscale`, `resizeNearest`, `threshold`                                                                        | `cv.cvtColor`, `cv.resize`, `cv.threshold`                            | One RGBA or luma-derived specialization each             |

The pinned OpenCV.js 4.13.0 browser fixture passes the AKAZE defaults and state mutations for all 15 instance members. Its `AKAZE` class is directly constructible, but the artifact omits the static `AKAZE.create` binding listed by the browser configuration. That blocks a direct runtime comparison for `createAKAZE` without changing the 488-family inventory.

The fixture also exposes the direct `KAZE` constructor and all 13 instance methods. Defaults and mutations pass, including the finite threshold `-1` and each typed diffusivity value. The artifact omits the config-listed static `KAZE.create` binding, so `createKAZE` has no direct static-factory comparison.

The same fixture passes defaults and mutations for all seven AGAST and all seven FAST instance methods. The threshold checks include signed values outside the usual detector range: AGAST preserves `-1`, and FAST preserves `256`. The official artifact exposes both direct constructors but omits the config-listed static `create` method on each class. That leaves both package factories without a direct static-factory comparison.

The fixture exposes the direct `GFTTDetector` constructor and all 13 instance methods. Its exact defaults pass, and every numeric setter preserves `-1`. The floating-point setters also preserve `NaN`, positive infinity, and negative infinity. The artifact omits the config-listed static `GFTTDetector.create` method. The package factory currently covers one six-argument shape and does not cover the `gradientSize` overload.

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
