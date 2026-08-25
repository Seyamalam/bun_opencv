# API reference

The package accepts and returns RGBA buffers. Each pixel occupies four bytes in red, green, blue, alpha order.

## Initialization

### `initOpenCv()`

Loads the generated WebAssembly module and returns `Promise<OpenCv>`. Call it in a browser or bundler that can load emitted `.wasm` assets.

### `createOpenCv(backend)`

Creates a client from an object that implements `OpenCvBackend`. This is useful for alternate runtimes and tests. Application code should normally call `initOpenCv()`.

## Images

### `RgbaImage`

```ts
interface RgbaImage {
  readonly data: Uint8Array;
  readonly height: number;
  readonly width: number;
}
```

Width and height must be positive 32-bit integers. `data.byteLength` must equal `width * height * 4`. The complete byte length must also fit into the 32-bit WASM address space.

### `createRgbaImage(width, height, data)`

Validates the dimensions and copies `data`. Copying prevents a later caller mutation from changing an image that has already passed validation.

### `rgbaImageFromImageData(imageData)`

Copies browser `ImageData` into an `RgbaImage`.

### `imageDataFromRgbaImage(image)`

Validates the image and returns browser `ImageData` backed by a new `Uint8ClampedArray`.

## Operations

### `grayscale(image)`

Writes the same luma value to red, green, and blue. The integer formula is `(77R + 150G + 29B + 128) >> 8`. Alpha is unchanged.

### `invert(image)`

Replaces each RGB byte `x` with `255 - x`. Alpha is unchanged.

### `threshold(image, threshold)`

Calculates luma with the grayscale formula. Pixels whose luma is greater than or equal to `threshold` become white. The rest become black. The threshold must be an integer from 0 through 255. Alpha is unchanged.

### `resizeNearest(image, targetWidth, targetHeight)`

Resizes an RGBA image with nearest-neighbor sampling. Both target dimensions must be positive 32-bit integers.

## Errors

The TypeScript boundary throws `OpenCvInputError` for invalid dimensions, byte lengths, and thresholds. Rust rejects the same invalid dimensions and byte lengths if a caller bypasses the TypeScript client.

## Matrices

### `cv.matFromU8(rows, columns, channels, data)`

Validates metadata once, copies the input into Rust-owned WASM memory, and returns a `Mat`. Version 0.1 supports unsigned 8-bit elements with 1 through 512 interleaved channels.

### `cv.zerosU8(rows, columns, channels)`

Allocates a zero-filled matrix directly in Rust-owned WASM memory.

### `matrix.roi(row, column, rows, columns)`

Returns a matrix that shares its parent's Rust allocation. Creating a region does not copy pixels. A multi-row region may have a `rowStride` larger than its logical row width. `isContinuous` reports whether the logical bytes occupy one range.

### `matrix.toUint8Array()`

Copies logical bytes into compact JavaScript memory. Strided regions omit bytes outside the region.

### `matrix.dispose()`

Releases the WASM handle. Calling it more than once is safe. Each region owns a separate handle, so disposing a parent does not invalidate an existing region. Accessing a disposed handle throws `OpenCvInputError`.
