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

Regions share Rust storage without copying pixels. The current operations still accept `RgbaImage`; moving the first operation slice onto `Mat` is next.

## Current API

- `cv.grayscale(image)` converts RGB channels to fixed-point BT.601 luma and keeps alpha.
- `cv.invert(image)` inverts RGB channels and keeps alpha.
- `cv.threshold(image, value)` emits black or white pixels using an inclusive threshold from 0 through 255.
- `cv.resizeNearest(image, width, height)` resizes with nearest-neighbor sampling.

Read [the API reference](docs/API.md) for input contracts and conversion helpers.

## Parity

The table comes from the checked parity ledger. `bun run parity:check` fails when an implemented TypeScript method, Rust export, README row, or generated JSON record disagrees.

| Module  | Package method    | OpenCV.js target                       | Status      |
| ------- | ----------------- | -------------------------------------- | ----------- |
| core    | `invert`          | `cv.bitwise_not`                       | Implemented |
| imgproc | `grayscale`       | `cv.cvtColor` with `COLOR_RGBA2GRAY`   | Implemented |
| imgproc | `resizeNearest`   | `cv.resize` with `INTER_NEAREST`       | Implemented |
| imgproc | `threshold`       | `cv.threshold` with `THRESH_BINARY`    | Implemented |
| imgproc | `cvtColor`        | General `cv.cvtColor` conversion codes | Planned     |
| imgproc | `gaussianBlur`    | `cv.GaussianBlur`                      | Planned     |
| imgproc | `canny`           | `cv.Canny`                             | Planned     |
| imgproc | `findContours`    | `cv.findContours`                      | Planned     |
| imgproc | `warpPerspective` | `cv.warpPerspective`                   | Planned     |

Tracked progress is 4 of 9 operations. That is not 44% of OpenCV.js. The next parity task independently inventories the complete pinned OpenCV.js binding set so every missing function, class, overload, enum, and constant is counted without copying its organized configuration. The target modules are `core`, `imgproc`, `objdetect`, `video`, `dnn`, `features2d`, `photo`, and `calib3d`.

Read [the complete parity contract](docs/PARITY.md) for the baseline, exclusions, and definition of done.

## What we build next

The Rust `Mat` and memory module now owns unsigned 8-bit storage, channels, dimensions, row stride, regions of interest, WASM allocation, and deterministic disposal. The next implementation work adds the remaining element depths, reusable outputs, and operations that accept `Mat` directly.

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
