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

## Fully implemented families

Fifty-six families meet the full-family definition. Current full parity is 56 of 488, or 11.48%.

| Package methods                                                                                                   | OpenCV.js families                              | Verified contract                                                        |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| `GFTTDetector.getBlockSize`, `GFTTDetector.getDefaultName`, `GFTTDetector.getHarrisDetector`                      | Matching `cv.GFTTDetector` getters              | Exact arity, defaults, return values, and deleted-handle errors          |
| `GFTTDetector.getK`, `GFTTDetector.getMaxFeatures`, `GFTTDetector.getMinDistance`, `GFTTDetector.getQualityLevel` | Matching `cv.GFTTDetector` numeric getters      | Exact signed i32, F64, non-finite, arity, and lifecycle behavior         |
| `GFTTDetector.setBlockSize`, `GFTTDetector.setMaxFeatures`                                                        | Matching `cv.GFTTDetector` integer setters      | Exact i32 coercion, undefined return, argument errors, and lifecycle     |
| `GFTTDetector.setHarrisDetector`                                                                                  | `cv.GFTTDetector.setHarrisDetector`             | Exact boolean coercion, undefined return, argument errors, and lifecycle |
| `GFTTDetector.setK`, `GFTTDetector.setMinDistance`, `GFTTDetector.setQualityLevel`                                | Matching `cv.GFTTDetector` F64 setters          | Exact number coercion, non-finite values, argument errors, and lifecycle |
| `AgastFeatureDetector.getDefaultName`, `FastFeatureDetector.getDefaultName`                                       | Matching AGAST and FAST name getters            | Exact arity, return values, argument errors, and lifecycle               |
| `AgastFeatureDetector.getNonmaxSuppression`, `FastFeatureDetector.getNonmaxSuppression`                           | Matching AGAST and FAST boolean getters         | Exact arity, boolean state, argument errors, and lifecycle               |
| `AgastFeatureDetector.getThreshold`, `FastFeatureDetector.getThreshold`                                           | Matching AGAST and FAST threshold getters       | Exact arity, signed i32 state, argument errors, and lifecycle            |
| `AgastFeatureDetector.setNonmaxSuppression`, `FastFeatureDetector.setNonmaxSuppression`                           | Matching AGAST and FAST boolean setters         | Exact boolean coercion, undefined return, argument errors, and lifecycle |
| `AgastFeatureDetector.setThreshold`, `FastFeatureDetector.setThreshold`                                           | Matching AGAST and FAST threshold setters       | Exact i32 coercion, undefined return, argument errors, and lifecycle     |
| `KAZE.getDefaultName`, `KAZE.getExtended`, `KAZE.getUpright`                                                      | Matching non-enum `cv.KAZE` getters             | Exact arity, names or boolean state, argument errors, and lifecycle      |
| `KAZE.getNOctaveLayers`, `KAZE.getNOctaves`, `KAZE.getThreshold`                                                  | Matching non-enum `cv.KAZE` numeric getters     | Exact signed i32 or F64 state, non-finite values, errors, and lifecycle  |
| `KAZE.setExtended`, `KAZE.setUpright`                                                                             | Matching non-enum `cv.KAZE` boolean setters     | Exact boolean coercion, undefined return, argument errors, and lifecycle |
| `KAZE.setNOctaveLayers`, `KAZE.setNOctaves`                                                                       | Matching non-enum `cv.KAZE` integer setters     | Exact i32 coercion, undefined return, argument errors, and lifecycle     |
| `KAZE.setThreshold`                                                                                               | `cv.KAZE.setThreshold`                          | Exact F64 coercion, non-finite values, argument errors, and lifecycle    |
| `AKAZE.getDefaultName`                                                                                            | `cv.AKAZE.getDefaultName`                       | Exact arity, return value, argument errors, and lifecycle                |
| `AKAZE.getDescriptorChannels`, `AKAZE.getDescriptorSize`                                                          | Matching non-enum `cv.AKAZE` descriptor getters | Exact signed i32 state, argument errors, and lifecycle                   |
| `AKAZE.getNOctaveLayers`, `AKAZE.getNOctaves`, `AKAZE.getThreshold`                                               | Matching non-enum `cv.AKAZE` numeric getters    | Exact signed i32 or F64 state, non-finite values, errors, and lifecycle  |
| `AKAZE.setDescriptorChannels`, `AKAZE.setDescriptorSize`                                                          | Matching non-enum `cv.AKAZE` descriptor setters | Exact i32 coercion, undefined return, argument errors, and lifecycle     |
| `AKAZE.setNOctaveLayers`, `AKAZE.setNOctaves`                                                                     | Matching non-enum `cv.AKAZE` octave setters     | Exact i32 coercion, undefined return, argument errors, and lifecycle     |
| `AKAZE.setThreshold`                                                                                              | `cv.AKAZE.setThreshold`                         | Exact F64 coercion, non-finite values, argument errors, and lifecycle    |
| `AKAZE.getDescriptorType`, `AKAZE.getDiffusivity`                                                                 | Matching enum-backed `cv.AKAZE` getters         | Canonical singleton identity, unknown wire values, arity, and lifecycle  |
| `AKAZE.setDescriptorType`, `AKAZE.setDiffusivity`                                                                 | Matching enum-backed `cv.AKAZE` setters         | Structural enum conversion, raw i32 state, errors, and lifecycle         |
| `KAZE.getDiffusivity`, `KAZE.setDiffusivity`                                                                      | Matching enum-backed `cv.KAZE` methods          | Shared singleton identity, structural conversion, errors, and lifecycle  |
| `AgastFeatureDetector.getType`, `AgastFeatureDetector.setType`                                                    | Matching enum-backed `cv.AgastFeatureDetector`  | Canonical identity, structural conversion, raw i32 state, and lifecycle  |
| `FastFeatureDetector.getType`, `FastFeatureDetector.setType`                                                      | Matching enum-backed `cv.FastFeatureDetector`   | Canonical identity, structural conversion, raw i32 state, and lifecycle  |
| `getOptimalDFTSize`                                                                                               | `cv.getOptimalDFTSize`                          | Exact arity, i32 coercion, smooth results, errors, and sentinel          |

## Working partial families

Seventy-three families have useful original Rust/WASM slices but do not meet the full-family definition. The project supports 129 families in total.

| Package methods                                        | OpenCV.js families                                                    | Current limit                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------- |
| `add`, `subtract`, `absdiff`, `min`, `max`             | `cv.add`, `cv.subtract`, `cv.absdiff`, `cv.min`, `cv.max`             | Matching U8 matrix operands                              |
| `bitwiseAnd`, `bitwiseOr`, `bitwiseXor`, `bitwiseNot`  | `cv.bitwise_and`, `cv.bitwise_or`, `cv.bitwise_xor`, `cv.bitwise_not` | U8 matrices without scalar or mask forms                 |
| `compareEqual`, `inRange`, `countNonZero`              | `cv.compare`, `cv.inRange`, `cv.countNonZero`                         | Selected U8 forms                                        |
| `flip`, `repeat`, `rotate`, `transpose`                | `cv.flip`, `cv.repeat`, `cv.rotate`, `cv.transpose`                   | All depths and mutable destinations                      |
| `split`, `merge`                                       | `cv.split`, `cv.merge`                                                | All depths; selected array call forms                    |
| `hconcat`, `vconcat`                                   | `cv.hconcat`, `cv.vconcat`                                            | All depths; two through four inputs                      |
| `exp`, `log`, `sqrt`, `pow`, `magnitude`               | Matching `cv` floating-point families                                 | F32/F64; selected return forms                           |
| `cartToPolar`, `polarToCart`                           | `cv.cartToPolar`, `cv.polarToCart`                                    | F32/F64 with mutable paired outputs                      |
| `multiply`, `divide`, `addWeighted`, `convertScaleAbs` | Matching `cv` numeric families                                        | All depths; selected matrix forms                        |
| `copyMakeBorder`                                       | `cv.copyMakeBorder`                                                   | All depths and five border modes                         |
| `lut`                                                  | `cv.LUT`                                                              | Byte sources and every table depth                       |
| `norm`, `normalize`                                    | `cv.norm`, `cv.normalize`                                             | All depths, masks, and major norm modes                  |
| `meanStdDev`, `reduce`                                 | `cv.meanStdDev`, `cv.reduce`                                          | All depths and mutable outputs                           |
| `mean`, `minMaxLoc`, `trace`                           | `cv.mean`, `cv.minMaxLoc`, `cv.trace`                                 | Masks or multi-channel trace remain                      |
| `mixChannels`                                          | `cv.mixChannels`                                                      | One source and destination; MatVector remains            |
| `setIdentity`, `randu`, `randn`, `setRNGSeed`          | Matching `cv` initialization and random families                      | Package RNG sequences differ from OpenCV                 |
| `getLogLevel`, `setLogLevel`                           | Matching `cv` logging families                                        | Log bindings stay absent from upstream browser artifact. |
| `transform`, `perspectiveTransform`                    | `cv.transform`, `cv.perspectiveTransform`                             | Selected channel and coefficient forms                   |
| `determinant`, `invert`, `solve`                       | `cv.determinant`, `cv.invert`, `cv.solve`                             | Selected dense single-channel methods                    |
| `arcLength`, `contourArea`, `boundingRect`             | Matching `cv` contour geometry families                               | I32/F32/F64 2D contour layouts                           |
| `isContourConvex`, `pointPolygonTest`                  | Matching `cv` polygon-query families                                  | Convexity, classification, or signed distance            |
| `getStructuringElement`, `createHanningWindow`         | Matching `cv` kernel and window families                              | U8 kernels or F32/F64 windows                            |
| `ellipse2Poly`, `clipLine`                             | Matching `cv` integer geometry helpers                                | Selected integer argument and return forms               |
| `getRotationMatrix2D`, `getAffineTransform`            | Matching `cv` affine matrix constructors                              | Selected finite inputs with F64 output                   |
| `invertAffineTransform`, `getPerspectiveTransform`     | Matching `cv` transform matrix families                               | Selected F32/F64 inputs with F64 output                  |
| `createAKAZE`                                          | `cv.AKAZE.create`                                                     | Static factory is absent from the pinned artifact        |
| `createKAZE`                                           | `cv.KAZE.create`                                                      | Static factory is absent from the pinned artifact        |
| `createAgastFeatureDetector`                           | `cv.AgastFeatureDetector.create`                                      | Static factory is absent from the pinned artifact        |
| `createFastFeatureDetector`                            | `cv.FastFeatureDetector.create`                                       | Static factory is absent from the pinned artifact        |
| `createGFTTDetector`                                   | `cv.GFTTDetector.create`                                              | One factory shape; `gradientSize` overload remains       |
| `grayscale`, `resizeNearest`, `threshold`              | `cv.cvtColor`, `cv.resize`, `cv.threshold`                            | One RGBA or luma-derived specialization each             |

The fixture exposes the direct `AKAZE` constructor and all 15 instance methods. Its complete matrix checks exact arity, defaults, return values, scalar coercion, enum namespaces and singleton identity, structural enum setters, raw unknown wire values, deletion, repeat deletion, and calls after deletion. All 15 instance methods pass and count as implemented. The config-listed static `AKAZE.create` binding is absent from the artifact, so the package factory remains partial.

The fixture passes the complete pinned browser contract for `getOptimalDFTSize`. It checks exact arity, Embind signed i32 coercion and errors, negative and zero inputs, smooth-size results, the exclusive `2,125,764,000` upper sentinel, and the remaining signed i32 boundary. Exhaustive Rust tests additionally verify minimality and every representable 2-, 3-, and 5-smooth boundary. This family counts as implemented.

The fixture exposes the direct `KAZE` constructor and all 13 instance methods. Its complete matrix checks exact arity, defaults, return values, scalar coercion, shared diffusivity singleton identity, structural enum setter behavior, raw unknown wire values, deletion, repeat deletion, and calls after deletion. All 13 instance methods pass and count as implemented. The config-listed static `KAZE.create` binding is absent from the artifact, so the package factory remains partial.

The same fixture passes the complete call contract for all seven AGAST and all seven FAST instance methods. It checks exact arity, return values, scalar coercion, enum namespaces and singleton identity, structural type setters, raw unknown wire values, deletion, repeat deletion, and calls after deletion. All 14 instance families count as implemented. The official artifact exposes direct constructors but omits the config-listed static `create` methods, so both package factories remain partial.

The fixture exposes the direct `GFTTDetector` constructor and all 13 instance methods. The complete pinned browser matrix checks exact method arity, defaults, return values, integer, number, and boolean coercion, missing and extra arguments, deletion, repeat deletion, and calls after deletion. All 13 instance methods pass and count as implemented. The artifact omits the config-listed static `GFTTDetector.create` method. The package factory remains partial because it covers one six-argument shape and omits the `gradientSize` overload.

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
