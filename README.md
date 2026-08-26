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

| Module     | Package method                              | OpenCV.js family                               | Status  | Current scope                           |
| ---------- | ------------------------------------------- | ---------------------------------------------- | ------- | --------------------------------------- |
| core       | `absdiff`                                   | `cv.absdiff`                                   | Partial | Matching U8 matrices                    |
| core       | `add`                                       | `cv.add`                                       | Partial | Saturating U8 matrix operands           |
| core       | `addWeighted`                               | `cv.addWeighted`                               | Partial | All depths and finite weights           |
| core       | `bitwiseAnd`                                | `cv.bitwise_and`                               | Partial | U8 matrix operands, no mask             |
| core       | `bitwiseNot`                                | `cv.bitwise_not`                               | Partial | U8 matrix, no mask                      |
| core       | `bitwiseOr`                                 | `cv.bitwise_or`                                | Partial | U8 matrix operands, no mask             |
| core       | `bitwiseXor`                                | `cv.bitwise_xor`                               | Partial | U8 matrix operands, no mask             |
| core       | `compareEqual`                              | `cv.compare`                                   | Partial | U8 equality mode                        |
| core       | `countNonZero`                              | `cv.countNonZero`                              | Partial | All single-channel scalar depths        |
| core       | `convertScaleAbs`                           | `cv.convertScaleAbs`                           | Partial | All input depths to saturated U8        |
| core       | `copyMakeBorder`                            | `cv.copyMakeBorder`                            | Partial | All depths and five border modes        |
| core       | `determinant`                               | `cv.determinant`                               | Partial | Square single-channel matrices          |
| core       | `divide`                                    | `cv.divide`                                    | Partial | All depths and matching matrices        |
| core       | `cartToPolar`                               | `cv.cartToPolar`                               | Partial | F32/F64 with mutable outputs            |
| core       | `exp`                                       | `cv.exp`                                       | Partial | F32/F64 element-wise output             |
| core       | `flip`                                      | `cv.flip`                                      | Partial | All depths and destination mutation     |
| core       | `getLogLevel`                               | `cv.getLogLevel`                               | Partial | Package-owned log level 0 through 6     |
| core       | `getOptimalDFTSize`                         | `cv.getOptimalDFTSize`                         | Partial | Signed 32-bit 5-smooth size planning    |
| core       | `hconcat`                                   | `cv.hconcat`                                   | Partial | All depths, two through four inputs     |
| core       | `inRange`                                   | `cv.inRange`                                   | Partial | U8 matrix bounds                        |
| core       | `invert`                                    | `cv.invert`                                    | Partial | Square matrices and three methods       |
| core       | `log`                                       | `cv.log`                                       | Partial | F32/F64 natural logarithm               |
| core       | `lut`                                       | `cv.LUT`                                       | Partial | Byte sources and every table depth      |
| core       | `magnitude`                                 | `cv.magnitude`                                 | Partial | Matching F32/F64 matrices               |
| core       | `max`                                       | `cv.max`                                       | Partial | U8 matrix operands                      |
| core       | `mean`                                      | `cv.mean`                                      | Partial | All depths, no mask                     |
| core       | `meanStdDev`                                | `cv.meanStdDev`                                | Partial | All depths, masks, and F64 outputs      |
| core       | `merge`                                     | `cv.merge`                                     | Partial | Two through four all-depth inputs       |
| core       | `min`                                       | `cv.min`                                       | Partial | U8 matrix operands                      |
| core       | `minMaxLoc`                                 | `cv.minMaxLoc`                                 | Partial | All single-channel depths, no mask      |
| core       | `mixChannels`                               | `cv.mixChannels`                               | Partial | One source and destination, all depths  |
| core       | `multiply`                                  | `cv.multiply`                                  | Partial | All depths and matching matrices        |
| core       | `norm`                                      | `cv.norm`                                      | Partial | All depths, masks, and norm modes       |
| core       | `normalize`                                 | `cv.normalize`                                 | Partial | All depths and mutable destinations     |
| core       | `polarToCart`                               | `cv.polarToCart`                               | Partial | F32/F64 with mutable outputs            |
| core       | `perspectiveTransform`                      | `cv.perspectiveTransform`                      | Partial | F32/F64 2D and 3D vectors               |
| core       | `pow`                                       | `cv.pow`                                       | Partial | F32/F64 and finite scalar exponent      |
| core       | `randn`                                     | `cv.randn`                                     | Partial | All depths and diagonal deviations      |
| core       | `randu`                                     | `cv.randu`                                     | Partial | All depths and per-channel ranges       |
| core       | `repeat`                                    | `cv.repeat`                                    | Partial | All depths, positive tile counts        |
| core       | `reduce`                                    | `cv.reduce`                                    | Partial | Both axes, four modes, all depths       |
| core       | `rotate`                                    | `cv.rotate`                                    | Partial | All depths and rotation codes           |
| core       | `setIdentity`                               | `cv.setIdentity`                               | Partial | All depths and in-place output          |
| core       | `setLogLevel`                               | `cv.setLogLevel`                               | Partial | Previous-level return and state update  |
| core       | `setRNGSeed`                                | `cv.setRNGSeed`                                | Partial | Deterministic package-owned RNG         |
| core       | `solve`                                     | `cv.solve`                                     | Partial | LU, Cholesky, and QR methods            |
| core       | `subtract`                                  | `cv.subtract`                                  | Partial | Saturating U8 matrix operands           |
| core       | `split`                                     | `cv.split`                                     | Partial | All depths and strided regions          |
| core       | `sqrt`                                      | `cv.sqrt`                                      | Partial | F32/F64 element-wise output             |
| core       | `transpose`                                 | `cv.transpose`                                 | Partial | All depths and destination mutation     |
| core       | `trace`                                     | `cv.trace`                                     | Partial | All depths, channel zero only           |
| core       | `transform`                                 | `cv.transform`                                 | Partial | All depths and F32/F64 coefficients     |
| core       | `vconcat`                                   | `cv.vconcat`                                   | Partial | All depths, two through four inputs     |
| features2d | `createAKAZE`                               | `cv.AKAZE.create`                              | Partial | Configuration handle only; no detection |
| features2d | `AKAZE.getDefaultName`                      | `cv.AKAZE.getDefaultName`                      | Partial | Package-owned configuration name        |
| features2d | `AKAZE.getDescriptorChannels`               | `cv.AKAZE.getDescriptorChannels`               | Partial | Descriptor channels 1 through 3         |
| features2d | `AKAZE.getDescriptorSize`                   | `cv.AKAZE.getDescriptorSize`                   | Partial | Non-negative descriptor size            |
| features2d | `AKAZE.getDescriptorType`                   | `cv.AKAZE.getDescriptorType`                   | Partial | KAZE and MLDB types 2 through 5         |
| features2d | `AKAZE.getDiffusivity`                      | `cv.AKAZE.getDiffusivity`                      | Partial | Diffusivity modes 0 through 3           |
| features2d | `AKAZE.getNOctaveLayers`                    | `cv.AKAZE.getNOctaveLayers`                    | Partial | Positive octave-layer state             |
| features2d | `AKAZE.getNOctaves`                         | `cv.AKAZE.getNOctaves`                         | Partial | Positive octave-count state             |
| features2d | `AKAZE.getThreshold`                        | `cv.AKAZE.getThreshold`                        | Partial | Finite non-negative threshold           |
| features2d | `AKAZE.setDescriptorChannels`               | `cv.AKAZE.setDescriptorChannels`               | Partial | Validated configuration mutation        |
| features2d | `AKAZE.setDescriptorSize`                   | `cv.AKAZE.setDescriptorSize`                   | Partial | Validated configuration mutation        |
| features2d | `AKAZE.setDescriptorType`                   | `cv.AKAZE.setDescriptorType`                   | Partial | Validated configuration mutation        |
| features2d | `AKAZE.setDiffusivity`                      | `cv.AKAZE.setDiffusivity`                      | Partial | Validated configuration mutation        |
| features2d | `AKAZE.setNOctaveLayers`                    | `cv.AKAZE.setNOctaveLayers`                    | Partial | Validated configuration mutation        |
| features2d | `AKAZE.setNOctaves`                         | `cv.AKAZE.setNOctaves`                         | Partial | Validated configuration mutation        |
| features2d | `AKAZE.setThreshold`                        | `cv.AKAZE.setThreshold`                        | Partial | Validated configuration mutation        |
| features2d | `createKAZE`                                | `cv.KAZE.create`                               | Partial | Configuration handle only; no detection |
| features2d | `KAZE.getDefaultName`                       | `cv.KAZE.getDefaultName`                       | Partial | Package-owned configuration name        |
| features2d | `KAZE.getDiffusivity`                       | `cv.KAZE.getDiffusivity`                       | Partial | Typed diffusivity state                 |
| features2d | `KAZE.getExtended`                          | `cv.KAZE.getExtended`                          | Partial | Extended-descriptor flag                |
| features2d | `KAZE.getNOctaveLayers`                     | `cv.KAZE.getNOctaveLayers`                     | Partial | Positive octave-layer state             |
| features2d | `KAZE.getNOctaves`                          | `cv.KAZE.getNOctaves`                          | Partial | Positive octave-count state             |
| features2d | `KAZE.getThreshold`                         | `cv.KAZE.getThreshold`                         | Partial | Any finite threshold                    |
| features2d | `KAZE.getUpright`                           | `cv.KAZE.getUpright`                           | Partial | Upright-descriptor flag                 |
| features2d | `KAZE.setDiffusivity`                       | `cv.KAZE.setDiffusivity`                       | Partial | Validated configuration mutation        |
| features2d | `KAZE.setExtended`                          | `cv.KAZE.setExtended`                          | Partial | Configuration mutation                  |
| features2d | `KAZE.setNOctaveLayers`                     | `cv.KAZE.setNOctaveLayers`                     | Partial | Validated configuration mutation        |
| features2d | `KAZE.setNOctaves`                          | `cv.KAZE.setNOctaves`                          | Partial | Validated configuration mutation        |
| features2d | `KAZE.setThreshold`                         | `cv.KAZE.setThreshold`                         | Partial | Finite threshold mutation               |
| features2d | `KAZE.setUpright`                           | `cv.KAZE.setUpright`                           | Partial | Configuration mutation                  |
| features2d | `createAgastFeatureDetector`                | `cv.AgastFeatureDetector.create`               | Partial | Configuration handle only; no detection |
| features2d | `AgastFeatureDetector.getDefaultName`       | `cv.AgastFeatureDetector.getDefaultName`       | Partial | Package-owned configuration name        |
| features2d | `AgastFeatureDetector.getNonmaxSuppression` | `cv.AgastFeatureDetector.getNonmaxSuppression` | Partial | Boolean configuration state             |
| features2d | `AgastFeatureDetector.getThreshold`         | `cv.AgastFeatureDetector.getThreshold`         | Partial | Signed 32-bit threshold state           |
| features2d | `AgastFeatureDetector.getType`              | `cv.AgastFeatureDetector.getType`              | Partial | AGAST types 0 through 3                 |
| features2d | `AgastFeatureDetector.setNonmaxSuppression` | `cv.AgastFeatureDetector.setNonmaxSuppression` | Partial | Configuration mutation                  |
| features2d | `AgastFeatureDetector.setThreshold`         | `cv.AgastFeatureDetector.setThreshold`         | Partial | Signed 32-bit mutation                  |
| features2d | `AgastFeatureDetector.setType`              | `cv.AgastFeatureDetector.setType`              | Partial | Validated configuration mutation        |
| features2d | `createFastFeatureDetector`                 | `cv.FastFeatureDetector.create`                | Partial | Configuration handle only; no detection |
| features2d | `FastFeatureDetector.getDefaultName`        | `cv.FastFeatureDetector.getDefaultName`        | Partial | Package-owned configuration name        |
| features2d | `FastFeatureDetector.getNonmaxSuppression`  | `cv.FastFeatureDetector.getNonmaxSuppression`  | Partial | Boolean configuration state             |
| features2d | `FastFeatureDetector.getThreshold`          | `cv.FastFeatureDetector.getThreshold`          | Partial | Signed 32-bit threshold state           |
| features2d | `FastFeatureDetector.getType`               | `cv.FastFeatureDetector.getType`               | Partial | FAST types 0 through 2                  |
| features2d | `FastFeatureDetector.setNonmaxSuppression`  | `cv.FastFeatureDetector.setNonmaxSuppression`  | Partial | Configuration mutation                  |
| features2d | `FastFeatureDetector.setThreshold`          | `cv.FastFeatureDetector.setThreshold`          | Partial | Signed 32-bit mutation                  |
| features2d | `FastFeatureDetector.setType`               | `cv.FastFeatureDetector.setType`               | Partial | Validated configuration mutation        |
| features2d | `createGFTTDetector`                        | `cv.GFTTDetector.create`                       | Partial | Selected six-argument configuration     |
| features2d | `GFTTDetector.getBlockSize`                 | `cv.GFTTDetector.getBlockSize`                 | Partial | Signed 32-bit block-size state          |
| features2d | `GFTTDetector.getDefaultName`               | `cv.GFTTDetector.getDefaultName`               | Partial | Package-owned configuration name        |
| features2d | `GFTTDetector.getHarrisDetector`            | `cv.GFTTDetector.getHarrisDetector`            | Partial | Boolean configuration state             |
| features2d | `GFTTDetector.getK`                         | `cv.GFTTDetector.getK`                         | Partial | F64 Harris coefficient state            |
| features2d | `GFTTDetector.getMaxFeatures`               | `cv.GFTTDetector.getMaxFeatures`               | Partial | Signed 32-bit feature-count state       |
| features2d | `GFTTDetector.getMinDistance`               | `cv.GFTTDetector.getMinDistance`               | Partial | F64 minimum-distance state              |
| features2d | `GFTTDetector.getQualityLevel`              | `cv.GFTTDetector.getQualityLevel`              | Partial | F64 quality-level state                 |
| features2d | `GFTTDetector.setBlockSize`                 | `cv.GFTTDetector.setBlockSize`                 | Partial | Signed 32-bit mutation                  |
| features2d | `GFTTDetector.setHarrisDetector`            | `cv.GFTTDetector.setHarrisDetector`            | Partial | Configuration mutation                  |
| features2d | `GFTTDetector.setK`                         | `cv.GFTTDetector.setK`                         | Partial | Signed and non-finite mutation          |
| features2d | `GFTTDetector.setMaxFeatures`               | `cv.GFTTDetector.setMaxFeatures`               | Partial | Signed 32-bit mutation                  |
| features2d | `GFTTDetector.setMinDistance`               | `cv.GFTTDetector.setMinDistance`               | Partial | Signed and non-finite mutation          |
| features2d | `GFTTDetector.setQualityLevel`              | `cv.GFTTDetector.setQualityLevel`              | Partial | Signed and non-finite mutation          |
| imgproc    | `arcLength`                                 | `cv.arcLength`                                 | Partial | I32/F32/F64 2D contour layouts          |
| imgproc    | `boundingRect`                              | `cv.boundingRect`                              | Partial | Inclusive bounds for 2D contours        |
| imgproc    | `clipLine`                                  | `cv.clipLine`                                  | Partial | Integer rectangle and segment form      |
| imgproc    | `contourArea`                               | `cv.contourArea`                               | Partial | Unsigned or oriented 2D contour area    |
| imgproc    | `createHanningWindow`                       | `cv.createHanningWindow`                       | Partial | F32/F64 two-dimensional windows         |
| imgproc    | `ellipse2Poly`                              | `cv.ellipse2Poly`                              | Partial | Ordered integer ellipse arcs            |
| imgproc    | `getAffineTransform`                        | `cv.getAffineTransform`                        | Partial | Three F32/F64 point pairs to F64        |
| imgproc    | `getPerspectiveTransform`                   | `cv.getPerspectiveTransform`                   | Partial | Four F32/F64 point pairs to F64         |
| imgproc    | `getRotationMatrix2D`                       | `cv.getRotationMatrix2D`                       | Partial | Finite scalars to a 2x3 F64 matrix      |
| imgproc    | `getStructuringElement`                     | `cv.getStructuringElement`                     | Partial | U8 rectangle, cross, or ellipse kernel  |
| imgproc    | `grayscale`                                 | `cv.cvtColor`                                  | Partial | RGBA-to-gray specialization             |
| imgproc    | `invertAffineTransform`                     | `cv.invertAffineTransform`                     | Partial | F32/F64 2x3 input to F64 inverse        |
| imgproc    | `isContourConvex`                           | `cv.isContourConvex`                           | Partial | Convexity for supported 2D contours     |
| imgproc    | `pointPolygonTest`                          | `cv.pointPolygonTest`                          | Partial | Classification or signed distance       |
| imgproc    | `resizeNearest`                             | `cv.resize`                                    | Partial | RGBA nearest-neighbor specialization    |
| imgproc    | `threshold`                                 | `cv.threshold`                                 | Partial | Luma-derived U8 binary specialization   |
| imgproc    | `gaussianBlur`                              | `cv.GaussianBlur`                              | Planned | Not started                             |
| imgproc    | `canny`                                     | `cv.Canny`                                     | Planned | Not started                             |
| imgproc    | `findContours`                              | `cv.findContours`                              | Planned | Not started                             |
| imgproc    | `warpPerspective`                           | `cv.warpPerspective`                           | Planned | Not started                             |

Current full parity is **0 of 488 (0%)**. There are **129 partial families** with working Rust/WASM slices. The milestone is **122 of 488**. `bun run parity:check` verifies these numbers against the inventory, TypeScript metadata, Rust exports, README rows, and generated JSON.

The pinned OpenCV.js 4.13.0 browser fixture passes AKAZE defaults and mutations for all 15 instance members. The same artifact exposes `AKAZE` as a directly constructible class but omits the config-listed static `AKAZE.create`, so the `createAKAZE` factory cannot receive direct runtime credit from that artifact.

The fixture passes KAZE defaults and mutations for all 13 instance methods, including threshold `-1` and typed diffusivity changes. The artifact exposes a direct `KAZE` constructor but omits the config-listed static `KAZE.create` method.

The fixture also passes AGAST and FAST defaults and mutations for all seven instance methods on each class. It preserves the signed AGAST threshold `-1` and the FAST threshold `256`. Both classes are directly constructible in the official artifact, but neither exposes the config-listed static `create` method.

The fixture passes the exact GFTT defaults and mutations for all 13 instance methods, including `-1` through every numeric setter and non-finite F64 values. The official artifact exposes the direct constructor but omits the config-listed static `GFTTDetector.create` method. The package factory covers one six-argument shape; the `gradientSize` overload remains.

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
