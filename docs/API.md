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

### U8 matrix operations

The following methods accept Rust-owned U8 `Mat` values and return a new Rust-owned `Mat` unless noted otherwise:

- `add(left, right)` and `subtract(left, right)` use unsigned saturation.
- `absdiff(left, right)`, `min(left, right)`, and `max(left, right)` operate element by element.
- `bitwiseAnd(left, right)`, `bitwiseOr(left, right)`, `bitwiseXor(left, right)`, and `bitwiseNot(source)` operate on every byte.
- `compareEqual(left, right)` returns 255 for equal elements and 0 otherwise.
- `inRange(source, lowerBound, upperBound)` applies inclusive per-channel bounds and returns a one-channel 255/0 mask.
- `countNonZero(source)` returns the number of non-zero elements and requires one channel.

Multi-input operations require identical rows, columns, and channels. These methods are working U8 slices, not yet complete OpenCV.js families; masks, scalar operands, optional destinations, and other depth forms remain tracked by the parity ledger.

### Matrix layout operations

- `flip(source, code)` accepts `-1`, `0`, or `1` for both axes, rows, or columns.
- `transpose(source)` swaps rows and columns.
- `rotate(source, code)` accepts `0`, `1`, or `2` for 90 degrees clockwise, 180 degrees, or 90 degrees counterclockwise.
- `repeat(source, rowRepeats, columnRepeats)` tiles a matrix by positive integer counts.

These operations preserve all seven scalar depths and every interleaved channel. They return new Rust-owned matrices and compact non-contiguous regions before rearranging pixels.

Each layout operation also accepts an OpenCV-style destination overload: `flip(source, destination, code)`, `transpose(source, destination)`, `rotate(source, destination, code)`, and `repeat(source, rows, columns, destination)`. Destinations must have the exact output shape, channels, and depth. Writes through regions update their shared parent storage.

The browser differential harness passes the pinned OpenCV.js 4.13.0 U8 fixtures for all four layout operations. Empty-matrix behavior and differential coverage across the remaining depths still need audit before these families receive full-parity credit.

### Matrix channels

- `split(source)` returns one single-channel matrix per input channel.
- `merge([first, second])`, `merge([first, second, third])`, and `merge([first, second, third, fourth])` interleave compatible inputs without invalidating them.
- `extractChannel(source, channel)` returns one selected channel.
- `insertChannel(source, destination, channel)` writes a single-channel source into one destination channel.
- `hconcat([first, second, ...])` and `vconcat([first, second, ...])` join two through four compatible matrices without invalidating their inputs.

Channel operations preserve raw scalar bytes for all seven depths and compact strided source regions. Insertions into a destination region update its shared parent storage.

### Floating-point math

- `exp(source)`, `log(source)`, `sqrt(source)`, and `pow(source, exponent)` apply element-wise math and return a new matrix.
- `magnitude(x, y)` computes vector length element by element.
- `cartToPolar(x, y, magnitude, angle, degrees)` writes lengths and angles into exact mutable destinations.
- `polarToCart(magnitude, angle, x, y, degrees)` writes cartesian components into exact mutable destinations.

These methods accept F32 and F64 matrices, including strided regions. The optional `degrees` argument defaults to `false`. Results follow Rust and WebAssembly IEEE 754 behavior; parity fixtures use declared tolerances because optimized OpenCV kernels may use different approximations.

### Typed numeric operations

- `multiply(a, b, scale)` and `divide(a, b, scale)` process matching matrices at every scalar depth.
- `addWeighted(a, alpha, b, beta, gamma)` combines matching matrices.
- `convertScaleAbs(source, alpha, beta)` computes an absolute affine transform into U8.

Integer outputs use nearest-even rounding and saturation. Integer division by zero produces zero. Floating-point outputs retain IEEE 754 behavior. Inputs may be strided regions.

### Matrix borders

`copyMakeBorder(source, top, bottom, left, right, borderType, constant)` supports constant, replicate, reflect, wrap, and reflect-101 modes, with the optional isolated bit. It preserves every scalar depth and channel layout. Constant values use nearest-even rounding and saturation for integer destinations.

### Lookup tables

`lut(source, table)` returns a transformed matrix. `lut(source, table, destination)` writes into an exact destination. Sources may use U8 or I8 elements. The table contains exactly 256 pixels with one channel or the same channel count as the source. Tables and outputs may use any scalar depth.

### Norms and normalization

`norm` supports one matrix or a matrix difference, optional U8 masks, numeric norms, Hamming norms, and relative flags. `normalize(source, destination, alpha, beta, type, mask)` writes INF, L1, L2, or MINMAX normalization into a caller-owned matrix. It converts between all scalar depths and preserves unselected destination pixels when a mask is present.

### Statistics and dimensional reduction

`meanStdDev(source, means, standardDeviations, mask)` writes one F64 mean and population standard deviation per channel. `reduce(source, destination, axis, kind)` reduces rows or columns with sum, average, maximum, or minimum. Reduction converts between every scalar depth and uses nearest-even saturated integer output.

### Matrix initialization and random fills

- `setIdentity(destination, value)` clears a matrix and writes `value` on its diagonal. The default scalar is `[1, 0, 0, 0]`.
- `randu(destination, lower, upper)` fills each channel from a half-open uniform range.
- `randn(destination, mean, standardDeviation)` fills each channel from a normal distribution.
- `setRNGSeed(seed)` resets the random stream from a signed 32-bit seed.

These methods mutate existing matrices and support all seven scalar depths, strided regions, and one through four channels. Uniform integer draws use floor conversion. Normal integer draws and identity values use nearest-even rounding and saturation. `randn` accepts channel-specific standard deviations but not a covariance matrix.

The random functions use an independently authored SplitMix64 stream and Box-Muller normal sampler. Resetting a seed reproduces package results. It does not reproduce OpenCV's random sequence, so these families remain partial.

### Per-element transforms

`transform(source, coefficients)` allocates a result. `transform(source, coefficients, destination)` writes into an exact destination. The source may use any scalar depth and one through four channels. Coefficients must be a single-channel F32 or F64 matrix with one row per output channel. It may contain one column per input channel for a linear transform or one extra column for an affine bias. The output keeps the source depth and may have a different channel count.

`perspectiveTransform(source, coefficients)` and its destination overload transform interleaved two- or three-component vectors. The source must use F32 or F64. Coefficients must be a single-channel square F32 or F64 matrix with one extra homogeneous row and column. The output keeps the source shape, channels, and depth.

Both methods compact strided inputs and snapshot inputs before destination writes. Differential fixtures against the pinned browser build remain.

### Dense matrix algebra

- `determinant(source)` returns an F64 determinant for a square, single-channel matrix. It accepts every scalar depth and uses partial-pivoted elimination.
- `invert(source, destination, method)` writes an inverse into an exact single-channel F32 or F64 destination. It returns `1` on success and `0` for a singular or rank-deficient source.
- `solve(coefficients, rightHandSides, destination, method)` solves one or more right-hand sides. It returns `false` on rank loss.

The decomposition method defaults to `0` for LU. Method `3` selects Cholesky and method `4` selects QR. LU and Cholesky require square coefficient matrices. QR also accepts overdetermined systems. SVD, eigen, normal-equation flags, pseudo-inverses, and underdetermined systems remain. Failed inverse and solve calls leave the destination unchanged. Inputs must be single-channel and finite. Inverse and solve destinations must use F32 or F64.

### Matrix reductions

- `countNonZero(source)` supports every scalar depth and requires one channel.
- `sum(source)` returns a four-number scalar and supports up to four channels. It is an extra convenience beyond the pinned 488-family browser ledger.
- `mean(source)` returns a four-number scalar and supports up to four channels.
- `minMaxLoc(source)` returns minimum and maximum values with their first row-major coordinates and requires one channel.
- `trace(source)` returns the channel-zero diagonal sum.

Reducers compact non-contiguous regions before decoding values. Floating-point sums, means, and traces propagate NaN. `minMaxLoc` skips NaN and throws when every value is NaN.

## Errors

The TypeScript boundary throws `OpenCvInputError` for invalid dimensions, byte lengths, and thresholds. Rust rejects the same invalid dimensions and byte lengths if a caller bypasses the TypeScript client.

## Matrices

### `cv.matFromU8(rows, columns, channels, data)`

Validates metadata once, copies the input into Rust-owned WASM memory, and returns a `Mat` with 1 through 512 interleaved channels.

Typed variants are `matFromI8`, `matFromU16`, `matFromI16`, `matFromI32`, `matFromF32`, and `matFromF64`. Each accepts the corresponding JavaScript typed array. Matrix depth codes follow OpenCV's scalar-depth order from U8 through F64.

### `cv.zerosU8(rows, columns, channels)`

Allocates a zero-filled matrix directly in Rust-owned WASM memory.

Typed variants are `zerosI8`, `zerosU16`, `zerosI16`, `zerosI32`, `zerosF32`, and `zerosF64`.

### `matrix.roi(row, column, rows, columns)`

Returns a matrix that shares its parent's Rust allocation. Creating a region does not copy pixels. A multi-row region may have a `rowStride` larger than its logical row width. `isContinuous` reports whether the logical bytes occupy one range.

### `matrix.toUint8Array()`

Copies logical bytes into compact JavaScript memory. For a U8 matrix those bytes are elements. For every other depth this method returns the compact raw byte representation. Strided regions omit bytes outside the region.

Typed element copies are available through `toInt8Array`, `toUint16Array`, `toInt16Array`, `toInt32Array`, `toFloat32Array`, and `toFloat64Array`. Calling a typed accessor that does not match the matrix depth throws.

### `matrix.copyFromBytes(data)`

Replaces the logical raw bytes of a matrix. The input length must equal `matrix.byteLength`. Writes are atomic and respect region stride, so overlapping regions and their parent observe the new values.

### `matrix.dispose()`

Releases the WASM handle. Calling it more than once is safe. Each region owns a separate handle, so disposing a parent does not invalidate an existing region. Accessing a disposed handle throws `OpenCvInputError`.
