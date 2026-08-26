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

| Module  | Package method    | OpenCV.js family     | Status  | Current scope                         |
| ------- | ----------------- | -------------------- | ------- | ------------------------------------- |
| core    | `absdiff`         | `cv.absdiff`         | Partial | Matching U8 matrices                  |
| core    | `add`             | `cv.add`             | Partial | Saturating U8 matrix operands         |
| core    | `bitwiseAnd`      | `cv.bitwise_and`     | Partial | U8 matrix operands, no mask           |
| core    | `bitwiseNot`      | `cv.bitwise_not`     | Partial | U8 matrix, no mask                    |
| core    | `bitwiseOr`       | `cv.bitwise_or`      | Partial | U8 matrix operands, no mask           |
| core    | `bitwiseXor`      | `cv.bitwise_xor`     | Partial | U8 matrix operands, no mask           |
| core    | `compareEqual`    | `cv.compare`         | Partial | U8 equality mode                      |
| core    | `countNonZero`    | `cv.countNonZero`    | Partial | All single-channel scalar depths      |
| core    | `flip`            | `cv.flip`            | Partial | All depths and destination mutation   |
| core    | `inRange`         | `cv.inRange`         | Partial | U8 matrix bounds                      |
| core    | `max`             | `cv.max`             | Partial | U8 matrix operands                    |
| core    | `mean`            | `cv.mean`            | Partial | All depths, no mask                   |
| core    | `merge`           | `cv.merge`           | Partial | Two through four all-depth inputs     |
| core    | `min`             | `cv.min`             | Partial | U8 matrix operands                    |
| core    | `minMaxLoc`       | `cv.minMaxLoc`       | Partial | All single-channel depths, no mask    |
| core    | `repeat`          | `cv.repeat`          | Partial | All depths, positive tile counts      |
| core    | `rotate`          | `cv.rotate`          | Partial | All depths and rotation codes         |
| core    | `subtract`        | `cv.subtract`        | Partial | Saturating U8 matrix operands         |
| core    | `split`           | `cv.split`           | Partial | All depths and strided regions        |
| core    | `transpose`       | `cv.transpose`       | Partial | All depths and destination mutation   |
| core    | `trace`           | `cv.trace`           | Partial | All depths, channel zero only         |
| imgproc | `grayscale`       | `cv.cvtColor`        | Partial | RGBA-to-gray specialization           |
| imgproc | `resizeNearest`   | `cv.resize`          | Partial | RGBA nearest-neighbor specialization  |
| imgproc | `threshold`       | `cv.threshold`       | Partial | Luma-derived U8 binary specialization |
| imgproc | `gaussianBlur`    | `cv.GaussianBlur`    | Planned | Not started                           |
| imgproc | `canny`           | `cv.Canny`           | Planned | Not started                           |
| imgproc | `findContours`    | `cv.findContours`    | Planned | Not started                           |
| imgproc | `warpPerspective` | `cv.warpPerspective` | Planned | Not started                           |

Current full parity is **0 of 488 (0%)**. There are **24 partial families** with working Rust/WASM slices. The milestone is **122 of 488**. `bun run parity:check` verifies these numbers against the inventory, TypeScript metadata, Rust exports, README rows, and generated JSON.

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
