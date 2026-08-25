# Roadmap

This roadmap orders work by dependency. The target is full OpenCV.js browser-binding parity, not the full native C++ build. The official browser configuration is the denominator.

## 0.1, package foundation

- Publish a browser ESM package with Rust-generated WASM.
- Validate RGBA inputs at both TypeScript and Rust boundaries.
- Ship grayscale, invert, binary threshold, and nearest-neighbor resize.
- Keep version and parity claims machine-checked.

## 0.2, inventory, matrices, and measurement

- Keep OpenCV.js 4.13.0 pinned and independently author its browser binding inventory.
- Generate module, function, class, overload, enum, and constant counts from that snapshot.
- Replace one-off RGBA buffers with a typed Rust `Mat` and strided views.
- Add deterministic WASM allocation, reusable output buffers, and regions of interest.
- Build a real-browser differential harness against the pinned OpenCV.js package.
- Build the benchmark harness described in [the performance contract](docs/PERFORMANCE.md).

## 0.3, first complete image-processing slice

- Implement the tracked `cvtColor` conversion codes.
- Implement nearest, linear, area, cubic, and Lanczos resize modes from the pinned baseline.
- Add border handling, convolution, Gaussian blur, box filters, median blur, and bilateral filtering.
- Add Sobel, Scharr, Laplacian, morphology, threshold variants, and Canny.
- Add scalar and WASM SIMD kernels with identical fixtures.

## 0.4, core and geometry

- Complete core arithmetic, channel operations, reductions, transforms, decompositions, and random functions.
- Complete contours, connected components, histograms, drawing, remapping, affine transforms, and perspective transforms.
- Add feature detection and descriptors after shared gradients and pyramids settle.

## 0.5, browser parallelism

- Add a worker pool for operations that exceed a measured size threshold.
- Add a `SharedArrayBuffer` build for cross-origin-isolated pages.
- Keep a single-thread fallback for every operation.
- Add fused pipelines so intermediate matrices remain in WASM memory.

## 0.6 through 1.0, close the ledger

- Complete `features2d`, `photo`, `video`, `objdetect`, and `calib3d` in dependency order.
- Add DNN tensor storage, model parsing, graph execution, and WebGPU or WebNN adapters where they beat WASM.
- Remove every `planned` or `missing` entry from the pinned OpenCV.js ledger.
- Publish parity and benchmark reports as versioned release artifacts.
- Release 1.0 only when the full pinned ledger passes in supported browsers.
