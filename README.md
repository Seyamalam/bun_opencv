# bun-opencv

`bun-opencv` is an experimental browser image-processing package written in Rust and TypeScript. Rust owns the pixel loops. WebAssembly carries them into the browser. The TypeScript layer validates inputs and provides an API that works with `ImageData`.

Version 0.1.0 implements four RGBA operations: grayscale, invert, binary threshold, and nearest-neighbor resize. The long-term target is full parity with the browser bindings in the pinned OpenCV.js 4.x baseline, followed by typed browser adapters that OpenCV.js does not provide.

## Install

The package is not published yet. After the first release:

```sh
bun add bun-opencv
```

The npm equivalent is `npm install bun-opencv`.

## Browser example

```ts
import { imageDataFromRgbaImage, initOpenCv, rgbaImageFromImageData } from "bun-opencv";

const canvas = document.querySelector("canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Expected a canvas element");
}

const context = canvas.getContext("2d");
if (context === null) {
  throw new Error("Canvas 2D is unavailable");
}

const cv = await initOpenCv();
const source = context.getImageData(0, 0, canvas.width, canvas.height);
const result = cv.grayscale(rgbaImageFromImageData(source));
context.putImageData(imageDataFromRgbaImage(result), 0, 0);
```

`initOpenCv()` loads the WASM module once per call. Keep the returned client and reuse it. Inputs and outputs use copied `Uint8Array` buffers in 0.1.0. A shared-memory API belongs to a later performance milestone.

Rust-owned matrices are available for pipelines that should stay in WASM memory:

```ts
const matrix = cv.matFromU8(1080, 1920, 4, rgbaBytes);
const crop = matrix.roi(100, 200, 480, 640);

try {
  const compactCrop = crop.toUint8Array();
  // Pass compactCrop to canvas, WebCodecs, or another browser interface.
} finally {
  crop.dispose();
  matrix.dispose();
}
```

Regions share Rust storage without copying pixels. The core arithmetic, bitwise, comparison, range, and reduction slices accept `Mat` directly; the original RGBA convenience operations remain available.

## Current API

- `cv.grayscale(image)` converts RGB channels to fixed-point BT.601 luma and keeps alpha.
- `cv.invert(image)` inverts RGB channels and keeps alpha.
- `cv.threshold(image, value)` emits black or white pixels using an inclusive threshold from 0 through 255.
- `cv.resizeNearest(image, width, height)` resizes with nearest-neighbor sampling.

Read [the API reference](docs/API.md) for input contracts and conversion helpers.

## Parity

The independent browser inventory contains 488 callable families, so the 25% milestone is 122 fully compatible families. A family earns full credit only after every selected browser overload, supported matrix form, output mutation, error case, and differential fixture passes. A useful U8 specialization is recorded as partial and earns no full-parity credit.

| Module     | Package method                              | OpenCV.js family                               | Status  | Current scope                            |
| ---------- | ------------------------------------------- | ---------------------------------------------- | ------- | ---------------------------------------- |
| core       | `absdiff`                                   | `cv.absdiff`                                   | Partial | Matching U8 matrices                     |
| core       | `add`                                       | `cv.add`                                       | Partial | Saturating U8 matrix operands            |
| core       | `addWeighted`                               | `cv.addWeighted`                               | Full    | Exact all-depth mutable-output contract  |
| core       | `bitwiseAnd`                                | `cv.bitwise_and`                               | Partial | U8 matrix operands, no mask              |
| core       | `bitwiseNot`                                | `cv.bitwise_not`                               | Partial | U8 matrix, no mask                       |
| core       | `bitwiseOr`                                 | `cv.bitwise_or`                                | Partial | U8 matrix operands, no mask              |
| core       | `bitwiseXor`                                | `cv.bitwise_xor`                               | Partial | U8 matrix operands, no mask              |
| core       | `compareEqual`                              | `cv.compare`                                   | Partial | U8 equality mode                         |
| core       | `countNonZero`                              | `cv.countNonZero`                              | Full    | Exact all-depth single-channel reduction |
| core       | `convertScaleAbs`                           | `cv.convertScaleAbs`                           | Full    | Exact all-depth mutable-output contract  |
| core       | `copyMakeBorder`                            | `cv.copyMakeBorder`                            | Partial | All depths and five border modes         |
| core       | `determinant`                               | `cv.determinant`                               | Full    | Exact F32/F64 square-matrix contract     |
| core       | `divide`                                    | `cv.divide`                                    | Full    | Exact all-depth mutable-output contract  |
| core       | `cartToPolar`                               | `cv.cartToPolar`                               | Full    | Exact paired F32/F64 output contract     |
| core       | `exp`                                       | `cv.exp`                                       | Full    | Exact F32/F64 mutable-output contract    |
| core       | `flip`                                      | `cv.flip`                                      | Full    | Exact all-depth mutable-output contract  |
| core       | `getLogLevel`                               | `cv.getLogLevel`                               | Partial | Package-owned log level 0 through 6      |
| core       | `getOptimalDFTSize`                         | `cv.getOptimalDFTSize`                         | Full    | Exact i32 contract and smooth result     |
| core       | `hconcat`                                   | `cv.hconcat`                                   | Partial | All depths, two through four inputs      |
| core       | `inRange`                                   | `cv.inRange`                                   | Partial | U8 matrix bounds                         |
| core       | `invert`                                    | `cv.invert`                                    | Partial | Square matrices and three methods        |
| core       | `log`                                       | `cv.log`                                       | Full    | Exact F32/F64 mutable-output contract    |
| core       | `lut`                                       | `cv.LUT`                                       | Partial | Byte sources and every table depth       |
| core       | `magnitude`                                 | `cv.magnitude`                                 | Full    | Exact matching F32/F64 mutable output    |
| core       | `max`                                       | `cv.max`                                       | Partial | U8 matrix operands                       |
| core       | `mean`                                      | `cv.mean`                                      | Partial | All depths, no mask                      |
| core       | `meanStdDev`                                | `cv.meanStdDev`                                | Partial | All depths, masks, and F64 outputs       |
| core       | `merge`                                     | `cv.merge`                                     | Partial | Two through four all-depth inputs        |
| core       | `min`                                       | `cv.min`                                       | Partial | U8 matrix operands                       |
| core       | `minMaxLoc`                                 | `cv.minMaxLoc`                                 | Partial | All single-channel depths, no mask       |
| core       | `mixChannels`                               | `cv.mixChannels`                               | Partial | One source and destination, all depths   |
| core       | `multiply`                                  | `cv.multiply`                                  | Full    | Exact all-depth mutable-output contract  |
| core       | `norm`                                      | `cv.norm`                                      | Partial | All depths, masks, and norm modes        |
| core       | `normalize`                                 | `cv.normalize`                                 | Partial | All depths and mutable destinations      |
| core       | `polarToCart`                               | `cv.polarToCart`                               | Full    | Exact paired F32/F64 output contract     |
| core       | `perspectiveTransform`                      | `cv.perspectiveTransform`                      | Partial | F32/F64 2D and 3D vectors                |
| core       | `pow`                                       | `cv.pow`                                       | Full    | Exact all-depth valid-power contract     |
| core       | `randn`                                     | `cv.randn`                                     | Partial | All depths and diagonal deviations       |
| core       | `randu`                                     | `cv.randu`                                     | Partial | All depths and per-channel ranges        |
| core       | `repeat`                                    | `cv.repeat`                                    | Full    | Exact all-depth mutable-output contract  |
| core       | `reduce`                                    | `cv.reduce`                                    | Partial | Both axes, four modes, all depths        |
| core       | `rotate`                                    | `cv.rotate`                                    | Full    | Exact all-depth mutable-output contract  |
| core       | `setIdentity`                               | `cv.setIdentity`                               | Full    | Exact Scalar conversion and in-place ROI |
| core       | `setLogLevel`                               | `cv.setLogLevel`                               | Partial | Previous-level return and state update   |
| core       | `setRNGSeed`                                | `cv.setRNGSeed`                                | Partial | Deterministic package-owned RNG          |
| core       | `solve`                                     | `cv.solve`                                     | Partial | LU, Cholesky, and QR methods             |
| core       | `subtract`                                  | `cv.subtract`                                  | Partial | Saturating U8 matrix operands            |
| core       | `split`                                     | `cv.split`                                     | Partial | All depths and strided regions           |
| core       | `sqrt`                                      | `cv.sqrt`                                      | Full    | Exact F32/F64 mutable-output contract    |
| core       | `transpose`                                 | `cv.transpose`                                 | Full    | Exact all-depth mutable-output contract  |
| core       | `trace`                                     | `cv.trace`                                     | Partial | All depths, channel zero only            |
| core       | `transform`                                 | `cv.transform`                                 | Partial | All depths and F32/F64 coefficients      |
| core       | `vconcat`                                   | `cv.vconcat`                                   | Partial | All depths, two through four inputs      |
| features2d | `createAKAZE`                               | `cv.AKAZE.create`                              | Partial | Configuration handle only; no detection  |
| features2d | `AKAZE.getDefaultName`                      | `cv.AKAZE.getDefaultName`                      | Full    | Exact name, arity, and lifecycle         |
| features2d | `AKAZE.getDescriptorChannels`               | `cv.AKAZE.getDescriptorChannels`               | Full    | Exact signed i32 state and lifecycle     |
| features2d | `AKAZE.getDescriptorSize`                   | `cv.AKAZE.getDescriptorSize`                   | Full    | Exact signed i32 state and lifecycle     |
| features2d | `AKAZE.getDescriptorType`                   | `cv.AKAZE.getDescriptorType`                   | Full    | Canonical enum identity and lifecycle    |
| features2d | `AKAZE.getDiffusivity`                      | `cv.AKAZE.getDiffusivity`                      | Full    | Shared enum identity and lifecycle       |
| features2d | `AKAZE.getNOctaveLayers`                    | `cv.AKAZE.getNOctaveLayers`                    | Full    | Exact signed i32 state and lifecycle     |
| features2d | `AKAZE.getNOctaves`                         | `cv.AKAZE.getNOctaves`                         | Full    | Exact signed i32 state and lifecycle     |
| features2d | `AKAZE.getThreshold`                        | `cv.AKAZE.getThreshold`                        | Full    | Exact F64 state and lifecycle            |
| features2d | `AKAZE.setDescriptorChannels`               | `cv.AKAZE.setDescriptorChannels`               | Full    | Exact i32 coercion and call contract     |
| features2d | `AKAZE.setDescriptorSize`                   | `cv.AKAZE.setDescriptorSize`                   | Full    | Exact i32 coercion and call contract     |
| features2d | `AKAZE.setDescriptorType`                   | `cv.AKAZE.setDescriptorType`                   | Full    | Exact structural enum-object coercion    |
| features2d | `AKAZE.setDiffusivity`                      | `cv.AKAZE.setDiffusivity`                      | Full    | Exact structural enum-object coercion    |
| features2d | `AKAZE.setNOctaveLayers`                    | `cv.AKAZE.setNOctaveLayers`                    | Full    | Exact i32 coercion and call contract     |
| features2d | `AKAZE.setNOctaves`                         | `cv.AKAZE.setNOctaves`                         | Full    | Exact i32 coercion and call contract     |
| features2d | `AKAZE.setThreshold`                        | `cv.AKAZE.setThreshold`                        | Full    | Exact number coercion and call contract  |
| features2d | `createKAZE`                                | `cv.KAZE.create`                               | Partial | Configuration handle only; no detection  |
| features2d | `KAZE.getDefaultName`                       | `cv.KAZE.getDefaultName`                       | Full    | Exact name, arity, and lifecycle         |
| features2d | `KAZE.getDiffusivity`                       | `cv.KAZE.getDiffusivity`                       | Full    | Shared enum identity and lifecycle       |
| features2d | `KAZE.getExtended`                          | `cv.KAZE.getExtended`                          | Full    | Exact boolean state and lifecycle        |
| features2d | `KAZE.getNOctaveLayers`                     | `cv.KAZE.getNOctaveLayers`                     | Full    | Exact signed i32 state and lifecycle     |
| features2d | `KAZE.getNOctaves`                          | `cv.KAZE.getNOctaves`                          | Full    | Exact signed i32 state and lifecycle     |
| features2d | `KAZE.getThreshold`                         | `cv.KAZE.getThreshold`                         | Full    | Exact F64 state and lifecycle            |
| features2d | `KAZE.getUpright`                           | `cv.KAZE.getUpright`                           | Full    | Exact boolean state and lifecycle        |
| features2d | `KAZE.setDiffusivity`                       | `cv.KAZE.setDiffusivity`                       | Full    | Exact structural enum-object coercion    |
| features2d | `KAZE.setExtended`                          | `cv.KAZE.setExtended`                          | Full    | Exact boolean coercion and call contract |
| features2d | `KAZE.setNOctaveLayers`                     | `cv.KAZE.setNOctaveLayers`                     | Full    | Exact i32 coercion and call contract     |
| features2d | `KAZE.setNOctaves`                          | `cv.KAZE.setNOctaves`                          | Full    | Exact i32 coercion and call contract     |
| features2d | `KAZE.setThreshold`                         | `cv.KAZE.setThreshold`                         | Full    | Exact number coercion and call contract  |
| features2d | `KAZE.setUpright`                           | `cv.KAZE.setUpright`                           | Full    | Exact boolean coercion and call contract |
| features2d | `createAgastFeatureDetector`                | `cv.AgastFeatureDetector.create`               | Partial | Configuration handle only; no detection  |
| features2d | `AgastFeatureDetector.getDefaultName`       | `cv.AgastFeatureDetector.getDefaultName`       | Full    | Exact name, arity, and lifecycle         |
| features2d | `AgastFeatureDetector.getNonmaxSuppression` | `cv.AgastFeatureDetector.getNonmaxSuppression` | Full    | Exact boolean state and lifecycle        |
| features2d | `AgastFeatureDetector.getThreshold`         | `cv.AgastFeatureDetector.getThreshold`         | Full    | Exact signed i32 state and lifecycle     |
| features2d | `AgastFeatureDetector.getType`              | `cv.AgastFeatureDetector.getType`              | Full    | Canonical enum identity and lifecycle    |
| features2d | `AgastFeatureDetector.setNonmaxSuppression` | `cv.AgastFeatureDetector.setNonmaxSuppression` | Full    | Exact boolean coercion and call contract |
| features2d | `AgastFeatureDetector.setThreshold`         | `cv.AgastFeatureDetector.setThreshold`         | Full    | Exact i32 coercion and call contract     |
| features2d | `AgastFeatureDetector.setType`              | `cv.AgastFeatureDetector.setType`              | Full    | Exact structural enum-object coercion    |
| features2d | `createFastFeatureDetector`                 | `cv.FastFeatureDetector.create`                | Partial | Configuration handle only; no detection  |
| features2d | `FastFeatureDetector.getDefaultName`        | `cv.FastFeatureDetector.getDefaultName`        | Full    | Exact name, arity, and lifecycle         |
| features2d | `FastFeatureDetector.getNonmaxSuppression`  | `cv.FastFeatureDetector.getNonmaxSuppression`  | Full    | Exact boolean state and lifecycle        |
| features2d | `FastFeatureDetector.getThreshold`          | `cv.FastFeatureDetector.getThreshold`          | Full    | Exact signed i32 state and lifecycle     |
| features2d | `FastFeatureDetector.getType`               | `cv.FastFeatureDetector.getType`               | Full    | Canonical enum identity and lifecycle    |
| features2d | `FastFeatureDetector.setNonmaxSuppression`  | `cv.FastFeatureDetector.setNonmaxSuppression`  | Full    | Exact boolean coercion and call contract |
| features2d | `FastFeatureDetector.setThreshold`          | `cv.FastFeatureDetector.setThreshold`          | Full    | Exact i32 coercion and call contract     |
| features2d | `FastFeatureDetector.setType`               | `cv.FastFeatureDetector.setType`               | Full    | Exact structural enum-object coercion    |
| features2d | `createGFTTDetector`                        | `cv.GFTTDetector.create`                       | Partial | Selected six-argument configuration      |
| features2d | `GFTTDetector.getBlockSize`                 | `cv.GFTTDetector.getBlockSize`                 | Full    | Exact arity, state, and lifecycle        |
| features2d | `GFTTDetector.getDefaultName`               | `cv.GFTTDetector.getDefaultName`               | Full    | Exact name, arity, and lifecycle         |
| features2d | `GFTTDetector.getHarrisDetector`            | `cv.GFTTDetector.getHarrisDetector`            | Full    | Exact boolean state and lifecycle        |
| features2d | `GFTTDetector.getK`                         | `cv.GFTTDetector.getK`                         | Full    | Exact F64 state and lifecycle            |
| features2d | `GFTTDetector.getMaxFeatures`               | `cv.GFTTDetector.getMaxFeatures`               | Full    | Exact signed i32 state and lifecycle     |
| features2d | `GFTTDetector.getMinDistance`               | `cv.GFTTDetector.getMinDistance`               | Full    | Exact F64 state and lifecycle            |
| features2d | `GFTTDetector.getQualityLevel`              | `cv.GFTTDetector.getQualityLevel`              | Full    | Exact F64 state and lifecycle            |
| features2d | `GFTTDetector.setBlockSize`                 | `cv.GFTTDetector.setBlockSize`                 | Full    | Exact i32 coercion and call contract     |
| features2d | `GFTTDetector.setHarrisDetector`            | `cv.GFTTDetector.setHarrisDetector`            | Full    | Exact boolean coercion and call contract |
| features2d | `GFTTDetector.setK`                         | `cv.GFTTDetector.setK`                         | Full    | Exact number coercion and call contract  |
| features2d | `GFTTDetector.setMaxFeatures`               | `cv.GFTTDetector.setMaxFeatures`               | Full    | Exact i32 coercion and call contract     |
| features2d | `GFTTDetector.setMinDistance`               | `cv.GFTTDetector.setMinDistance`               | Full    | Exact number coercion and call contract  |
| features2d | `GFTTDetector.setQualityLevel`              | `cv.GFTTDetector.setQualityLevel`              | Full    | Exact number coercion and call contract  |
| imgproc    | `arcLength`                                 | `cv.arcLength`                                 | Full    | Exact I32/F32 contour contract           |
| imgproc    | `boundingRect`                              | `cv.boundingRect`                              | Full    | Exact I32/F32 contour bounds             |
| imgproc    | `clipLine`                                  | `cv.clipLine`                                  | Partial | Integer rectangle and segment form       |
| imgproc    | `contourArea`                               | `cv.contourArea`                               | Full    | Exact I32/F32 contour area               |
| imgproc    | `createHanningWindow`                       | `cv.createHanningWindow`                       | Full    | Exact F32/F64 mutable window contract    |
| imgproc    | `ellipse2Poly`                              | `cv.ellipse2Poly`                              | Partial | Ordered integer ellipse arcs             |
| imgproc    | `getAffineTransform`                        | `cv.getAffineTransform`                        | Full    | Exact continuous F32 points and F64 map  |
| imgproc    | `getPerspectiveTransform`                   | `cv.getPerspectiveTransform`                   | Partial | Four F32/F64 point pairs to F64          |
| imgproc    | `getRotationMatrix2D`                       | `cv.getRotationMatrix2D`                       | Full    | Exact Point2f and F64 matrix contract    |
| imgproc    | `getStructuringElement`                     | `cv.getStructuringElement`                     | Full    | Exact rectangle, cross, ellipse, diamond |
| imgproc    | `grayscale`                                 | `cv.cvtColor`                                  | Partial | RGBA-to-gray specialization              |
| imgproc    | `invertAffineTransform`                     | `cv.invertAffineTransform`                     | Full    | Exact F32/F64 mutable inverse contract   |
| imgproc    | `isContourConvex`                           | `cv.isContourConvex`                           | Full    | Exact strict-convexity contract          |
| imgproc    | `pointPolygonTest`                          | `cv.pointPolygonTest`                          | Full    | Exact classification and signed distance |
| imgproc    | `resizeNearest`                             | `cv.resize`                                    | Partial | RGBA nearest-neighbor specialization     |
| imgproc    | `threshold`                                 | `cv.threshold`                                 | Partial | Luma-derived U8 binary specialization    |
| imgproc    | `gaussianBlur`                              | `cv.GaussianBlur`                              | Planned | Not started                              |
| imgproc    | `canny`                                     | `cv.Canny`                                     | Planned | Not started                              |
| imgproc    | `findContours`                              | `cv.findContours`                              | Planned | Not started                              |
| imgproc    | `warpPerspective`                           | `cv.warpPerspective`                           | Planned | Not started                              |

Current full parity is **84 of 488 (17.21%)**. There are **45 partial families**, for **129 supported families** in total. The milestone is **122 of 488**. `bun run parity:check` verifies these numbers against the inventory, TypeScript metadata, Rust exports, README rows, and generated JSON.

The fixture passes the complete pinned browser contract for `determinant`. The function requires exactly one live `Mat` and accepts only nonempty square single-channel F32 or F64 matrices, including non-contiguous regions. It preserves the input, matches the direct 1x1, 2x2, and 3x3 paths with signed-zero and non-finite propagation, and keeps F32 and F64 arithmetic distinct during elimination for larger matrices. The audit locks the absolute pivot cutoffs, exact cutoff acceptance, row-swap signs, singular positive zero, stored-F32 widening in the small formulas, and Hilbert precision. Integer, multichannel, nonsquare, empty, deleted, and non-Mat inputs reject before computation.

The fixture passes the complete pinned browser contract for `exp`, `log`, `sqrt`, `pow`, and `magnitude`. It checks exact arity and Mat conversion, Embind F64 power conversion, typed and canonical empty matrices, destination replacement, detached and shared regions, live overlapping traversal, all valid scalar depths, integer saturation and wrapping, and floating-point bit patterns. The package rejects native calls that expose unsafe uninitialized output while preserving the observable rejection and unchanged-state contract.

The fixture also passes the pinned `cartToPolar` and `polarToCart` contracts. It covers both overloads, JavaScript truthiness, F32/F64 multichannel matrices, paired destination replacement, typed empty layouts, full-rotation angles, live overlapping regions, shared-output rejection, and the reference runtime's F32 precision path for both accepted depths.

The fixture passes the complete pinned contracts for `multiply`, `divide`, `addWeighted`, and `convertScaleAbs`. It covers exact overload dispatch, Embind scalar coercion, all seven depths, explicit mixed-depth conversion, OutputArray replacement, live shared regions, typed empty layouts, floating-point edges, and the reference runtime's non-saturating CV_32S overflow paths.

The fixture passes the complete pinned contracts for `arcLength`, `contourArea`, and `boundingRect`. It covers exact arity and runtime length, JavaScript truthiness, I32 and F32 contours in `Nx1C2`, `1xNC2`, and `Nx2C1` layouts, deleted inputs, canonical empty bounds, and rejection of F64, U8, and invalid shapes. The package rejects typed empty contours before entering upstream paths that do not return a safe JavaScript error.

The fixture also passes the complete pinned contracts for `isContourConvex` and `pointPolygonTest`. It covers exact arity, strict convexity, continuous I32/F32 layouts, structural Point2f conversion, float32 narrowing, JavaScript truthiness, one-point and segment contours, classification, signed distance, traversal-dependent signed zero, non-finite query sentinels, deleted and empty inputs, and rejected depths, shapes, and regions.

The fixture passes the complete pinned `getRotationMatrix2D` contract. It checks the exact three-argument call, structural Point2f field order and float32 narrowing, strict Embind double conversion for angle and scale, boolean inputs, signed zero, non-finite propagation, bit-exact 2x3 F64 coefficients, and independent result ownership.

The fixture passes the complete pinned browser contract for `rotate`, including exact arity and constants, Embind signed i32 conversion, all scalar depths, empty and deleted matrices, OutputArray replacement, in-place operation, detached regions, and live shared-region composition. Invalid native codes preserve the observable no-throw contract without exposing the official build's unsafe output state.

The fixture passes the complete pinned browser contract for `repeat`, including exact arity, Embind signed i32 conversion, all scalar depths, empty and deleted matrices, OutputArray replacement, compatible and detached regions, exact in-place rejection, and live overlapping shared-region traversal. Invalid native calls are compared by rejection and unchanged state because the official build exposes transient numeric exception pointers; this package preserves stable Rust errors.

The fixture passes the complete pinned browser contract for `countNonZero`, including exact arity and Mat conversion errors, all seven scalar depths available in the artifact, signed zero, NaN, infinities, subnormal values, fresh empty matrices, deleted handles, and non-contiguous regions. Multi-channel rejection is compared semantically because the official build throws a transient numeric native-exception pointer; this package preserves a stable Rust error instead.

The fixture passes the complete pinned browser contract for `getOptimalDFTSize`, including exact arity, Embind signed i32 coercion and errors, negative and zero inputs, every smooth-size boundary exercised by Rust tests, and the exclusive `2,125,764,000` upper sentinel. This family counts as full parity.

The fixture passes the complete pinned browser contract for all 15 AKAZE instance methods. In addition to the scalar checks, the four enum methods match the official enum namespaces, canonical singleton identity, structural setter coercion, raw unknown wire values, arity errors, and lifetime behavior. The factory remains partial because the pinned artifact omits its config-listed static constructor.

The fixture passes the complete pinned browser contract for all 13 KAZE instance methods. Its diffusivity getter returns the shared canonical enum singleton, and its setter applies the official structural enum-object conversion while preserving unknown signed i32 wire values. The factory remains partial because the pinned artifact omits its config-listed static constructor.

The fixture passes the complete pinned browser contract for all seven AGAST and all seven FAST instance methods. The type methods match the official enum namespaces, canonical singleton identity, structural setter coercion, raw unknown wire values, arity errors, and lifetime behavior. Both factories remain partial because the pinned artifact omits their config-listed static constructors.

The fixture passes the complete pinned browser matrix for all 13 GFTT instance methods. It checks method arity, defaults, return values, integer, number, and boolean coercion, missing and extra arguments, deletion, repeat deletion, and calls after deletion. These 13 method families count as full parity. The official artifact exposes the direct constructor but omits the config-listed static `GFTTDetector.create` method. The package factory remains partial because it covers one six-argument shape and omits the `gradientSize` overload.

Read [the inventory](docs/INVENTORY.md) and [complete parity contract](docs/PARITY.md) for the denominator, exclusions, and definition of done.

## What we build next

The Rust `Mat` owns U8, I8, U16, I16, I32, F32, and F64 storage, plus channels, dimensions, byte strides, zero-copy regions, mutable destinations, WASM allocation, and deterministic disposal. The next foundation broadens arithmetic and image-processing families across every scalar depth while differential fixtures lock behavior to the pinned browser baseline.

After that foundation, the first vertical slice is general color conversion, all resize interpolation modes in the OpenCV.js baseline, convolution, Gaussian blur, Sobel gradients, and Canny. Each operation needs upstream differential fixtures and real-browser benchmarks before its parity status changes to implemented.

The performance goal is at least 2x the OpenCV.js geometric mean for warmed 1080p hot kernels and at least 4x for fused pipelines. Those are targets, not current results. Reports will include p50 and p95 timing, initialization, allocation counts, package bytes, scalar fallback results, and SIMD results. See [the performance contract](docs/PERFORMANCE.md).

## Browser and bundler requirements

Consumers need ES2022 modules, WebAssembly, dynamic `import()`, and support for package `imports` maps. Modern Vite, Rollup, webpack, and esbuild-based browser builds normally provide these pieces. The package does not include Node-specific image decoding or DOM polyfills.

## Develop locally

Install Bun, Rust, and the `wasm32-unknown-unknown` Rust target. The npm `wasm-pack` development dependency supplies the WASM build command.

```sh
bun install
bun run check
bun run build
```

Generated JavaScript and declarations go to `dist/`. The generated WASM loader and binary go to `wasm/`. Git ignores both directories; npm includes both in the packed release.

## Project documents

- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [OpenCV parity](docs/PARITY.md)
- [OpenCV.js browser inventory](docs/INVENTORY.md)
- [Performance contract](docs/PERFORMANCE.md)
- [Source-independent compatibility policy](docs/COMPATIBILITY_POLICY.md)
- [Licensing research](docs/LICENSING_RESEARCH.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [Roadmap](ROADMAP.md)
- [TODO](TODO.md)
- [Contributing](CONTRIBUTING.md)
- [Versioning](docs/VERSIONING.md)
- [Publishing](docs/PUBLISHING.md)
- [Security](SECURITY.md)
- [Changelog](CHANGELOG.md)

## License

MIT. See [LICENSE](LICENSE).

OpenCV is a trademark of its owner. This independent project is not affiliated with or endorsed by OpenCV. `bun-opencv` remains a working name and publication is blocked until it receives trademark review or changes.
