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

Multi-input operations require identical rows, columns, and channels. These methods are working U8 slices, not yet complete OpenCV.js families; masks, scalar operands, optional destinations, and other depth forms remain tracked by the parity ledger.

### Matrix layout operations

- `flipAlloc(source, code)` allocates a flipped matrix. Zero flips rows, positive signed 32-bit codes flip columns, and negative codes flip both axes.
- `transposeAlloc(source)` swaps rows and columns and allocates a new matrix.
- `rotateAlloc(source, code)` accepts `0`, `1`, or `2` for 90 degrees clockwise, 180 degrees, or 90 degrees counterclockwise and allocates its output.
- `repeatAlloc(source, rowRepeats, columnRepeats)` tiles a matrix and allocates its output.

These operations preserve all seven scalar depths and every interleaved channel. They return new Rust-owned matrices and compact non-contiguous regions before rearranging pixels.

Each layout operation also accepts an OpenCV-style destination form: `flip(source, destination, code)`, `transpose(source, destination)`, `rotate(source, destination, code)`, and `repeat(source, rows, columns, destination)`. All four use the exact OpenCV.js argument counts. They reuse compatible destinations, reallocate incompatible ordinary matrices, and detach incompatible regions. Compatible regions write through to shared parent storage.

The browser differential harness passes pinned OpenCV.js 4.13.0 all-depth fixtures for all four layout operations, including empty and deleted matrices, destination replacement, detached incompatible regions, and live overlapping aliases. Repeat matches the upstream exact in-place rejection contract; flip, transpose, and rotate match their valid in-place forms.

### Matrix channels

- `split(source)` returns one single-channel matrix per input channel.
- `merge([first, second])`, `merge([first, second, third])`, and `merge([first, second, third, fourth])` interleave compatible inputs without invalidating them.
- `extractChannel(source, channel)` returns one selected channel.
- `insertChannel(source, destination, channel)` writes a single-channel source into one destination channel.
- `mixChannels(source, destination, fromTo)` routes flattened source/destination channel pairs into an existing matrix while preserving unmapped destination channels.
- `hconcat([first, second, ...])` and `vconcat([first, second, ...])` join two through four compatible matrices without invalidating their inputs.

Channel operations preserve raw scalar bytes for all seven depths and compact strided source regions. Insertions and channel routing into a destination region update its shared parent storage. The current `mixChannels` slice accepts one source and one destination; MatVector forms remain.

### Floating-point math

- `exp(source, destination)`, `log(source, destination)`, and `sqrt(source, destination)` write element-wise results into exact mutable destinations. `expAlloc`, `logAlloc`, and `sqrtAlloc` allocate package-convenience outputs.
- `pow(source, exponent, destination)` writes element-wise powers into an exact mutable destination. `powAlloc` is the allocating convenience form.
- `magnitude(x, y, destination)` writes vector lengths into an exact mutable destination. `magnitudeAlloc` is the allocating convenience form.
- `cartToPolar(x, y, magnitude, angle, degrees)` writes lengths and angles into exact mutable destinations.
- `polarToCart(magnitude, angle, x, y, degrees)` writes cartesian components into exact mutable destinations.

`exp`, `log`, `sqrt`, and `magnitude` accept F32 and F64 matrices. `pow` accepts every scalar depth for valid integer powers and F32/F64 for the complete F64 exponent domain. The exact forms replace incompatible destinations, write through compatible regions, and traverse overlapping shared storage in pinned row-major order. Typed empty headers retain their rows, columns, channels, and depth. The package safely rejects integer `sqrt` and non-integral or non-finite integer `pow` calls because the pinned artifact exposes unsafe or uninitialized output for those inputs.

`cartToPolar` and `polarToCart` match the pinned four- and five-argument overloads. They accept matching F32 or F64 matrices with any channel count and replace both destinations when their metadata differs. Compatible regions write through shared storage, including the reference runtime's live row-major behavior when one output overlaps an input. Typed 0xN, Nx0, and 0x0 layouts retain their shape, channels, and depth. The optional `degrees` value defaults to `false` and follows JavaScript truthiness. Cartesian angles use a nonnegative full rotation. Both accepted depths follow the pinned F32 computation path. The package rejects shared paired outputs and native integer or canonical-empty calls before mutation because the reference artifact exposes assertion or transient numeric failures for those cases.

### Typed numeric operations

- `multiply(a, b, destination, scale?, dtype?)` and `divide(a, b, destination, scale?, dtype?)` match the pinned three-, four-, and five-argument matrix overloads. `multiplyAlloc` and `divideAlloc` are allocating conveniences.
- `addWeighted(a, alpha, b, beta, gamma, destination, dtype?)` matches the pinned six- and seven-argument overloads. `addWeightedAlloc` is the allocating convenience.
- `convertScaleAbs(source, destination, alpha?, beta?)` matches the pinned two-, three-, and four-argument overloads. `convertScaleAbsAlloc` is the allocating convenience.

The mutable forms support all seven scalar depths, strided and overlapping regions, incompatible destination replacement, and explicit mixed-depth output conversion. Integer outputs use nearest-even conversion and saturation except CV_32S, whose non-saturating overflow follows the pinned runtime. Integer division by zero produces zero. Floating-point outputs retain IEEE 754 behavior.

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

### Core runtime utilities

- `getLogLevel()` returns the package-owned log severity for the current WebAssembly instance.
- `setLogLevel(level)` updates that severity and returns the previous level.
- `getOptimalDFTSize(size)` returns the smallest integer at least as large as `size` whose only prime factors are 2, 3, and 5.

`LogLevel` is the integer union `0 | 1 | 2 | 3 | 4 | 5 | 6`, representing silent, fatal, error, warning, informational, debug, and verbose logging. The initial level is warning (`3`). Invalid levels throw `OpenCvInputError`. Logging state belongs to this package and one WebAssembly instance; it does not configure an installed OpenCV runtime.

OpenCV's 4.13.0 JavaScript binding configuration lists `getLogLevel` and `setLogLevel`, but the official documentation artifact used by the browser differential harness does not expose them at runtime. Their package behavior is covered by Rust and TypeScript tests; direct upstream runtime comparison is therefore unavailable for that pinned artifact.

`getOptimalDFTSize` requires exactly one argument; missing or extra arguments throw `BindingError`. Its plain-JavaScript boundary matches Embind signed i32 conversion: numeric fractions truncate toward zero, `NaN` becomes zero, and booleans become `1` or `0`. Numbers outside the signed 32-bit range, infinities, strings, `null`, and `undefined` throw `TypeError`.

After conversion, the function returns `-1` for negative values, `1` for zero and one, and otherwise returns the next 2-, 3-, and 5-smooth size. OpenCV.js treats `2,125,764,000` as an exclusive upper sentinel: `2,125,763,999` maps to it, while the sentinel itself and larger signed i32 inputs return `-1`. The pinned browser matrix verifies the call contract and boundary values, while exhaustive Rust tests verify minimality and every representable smooth-size transition.

### Per-element transforms

`transform(source, coefficients)` allocates a result. `transform(source, coefficients, destination)` writes into an exact destination. The source may use any scalar depth and one through four channels. Coefficients must be a single-channel F32 or F64 matrix with one row per output channel. It may contain one column per input channel for a linear transform or one extra column for an affine bias. The output keeps the source depth and may have a different channel count.

`perspectiveTransform(source, coefficients)` and its destination overload transform interleaved two- or three-component vectors. The source must use F32 or F64. Coefficients must be a single-channel square F32 or F64 matrix with one extra homogeneous row and column. The output keeps the source shape, channels, and depth.

Both methods compact strided inputs and snapshot inputs before destination writes. Differential fixtures against the pinned browser build remain.

### Contour geometry

```ts
interface Point {
  readonly x: number;
  readonly y: number;
}

interface Size {
  readonly height: number;
  readonly width: number;
}

interface Rect extends Size, Point {}

arcLength(contour: Mat, closed: boolean): number;
contourArea(contour: Mat, oriented?: boolean): number;
boundingRect(contour: Mat): Rect;
isContourConvex(contour: Mat): boolean;
pointPolygonTest(contour: Mat, point: Point, measureDistance: boolean): number;
```

These methods accept I32, F32, and F64 contours stored as `Nx1C2`, `1xNC2`, or `Nx2C1`. They read strided regions through their logical bytes. Other curve containers and points with more than two dimensions are not supported.

`arcLength` measures an open or closed perimeter. `contourArea` returns unsigned area by default and signed, oriented area when `oriented` is true. Fewer than three points have zero area. `boundingRect` floors fractional coordinates and returns inclusive integer bounds, so one integer point produces a 1-by-1 rectangle. Empty contours are rejected by perimeter and bounds operations.

`isContourConvex` accepts collinear points along an otherwise convex boundary. It returns false for fewer than three points or an entirely collinear contour, and it does not separately diagnose self-intersection. `pointPolygonTest` requires at least three points. It returns positive inside, negative outside, and zero on an edge. Without distance measurement, nonzero results are exactly `1` or `-1`. With distance measurement, the magnitude is the nearest-boundary distance. All five methods reject non-finite coordinates and numeric overflow.

### Image-processing helpers

```ts
type StructuringElementKind = 0 | 1 | 2;
type HanningWindowDepth = "f32" | "f64";

getStructuringElement(kind: StructuringElementKind, size: Size, anchor?: Point): Mat;
createHanningWindow(size: Size, depth: HanningWindowDepth): Mat;
ellipse2Poly(
  center: Point,
  axes: Size,
  rotationDegrees: number,
  arcStart: number,
  arcEnd: number,
  delta: number,
): Point[];
clipLine(rectangle: Rect, start: Point, end: Point): readonly [Point, Point] | undefined;
```

`getStructuringElement` returns a single-channel U8 kernel. Kind `0` is a rectangle, `1` is a cross, and `2` is an ellipse. Width and height must be positive. The default anchor is `{ x: -1, y: -1 }`, which selects the center of each dimension. A custom anchor moves the cross intersection. Rectangle and ellipse geometry stay centered. The compact result must fit the WASM matrix limit.

`createHanningWindow` returns a single-channel F32 or F64 matrix. Each dimension must be at least two. The implementation caps allocation at the conservative F64 WASM matrix limit. The values are the outer product of non-negative sine weights, which are the square roots of one-dimensional Hann coefficients.

`ellipse2Poly` accepts non-negative integer axes. Arc bounds must satisfy `0 <= arcStart <= arcEnd <= 360`, and `delta` must be from 1 through 180. It always samples the exact end angle and removes consecutive points that round to the same signed 32-bit coordinate. It does not normalize or swap arc bounds.

`clipLine` accepts a positive-size integer rectangle and signed 32-bit segment coordinates. It clips against inclusive pixel bounds. A visible segment returns two points; a disjoint segment returns `undefined`. Unlike the OpenCV call shape, this package returns new points instead of mutating caller-owned point objects. Rectangle right and bottom edges must fit signed 32-bit coordinates.

### Transform matrix constructors

```ts
getRotationMatrix2D(center: Point, angleDegrees: number, scale: number): Mat;
getAffineTransform(source: Mat, destination: Mat): Mat;
invertAffineTransform(transform: Mat): Mat;
getPerspectiveTransform(source: Mat, destination: Mat): Mat;
```

`getRotationMatrix2D` accepts finite center, angle, and scale values and returns a 2x3 single-channel F64 matrix.

`getAffineTransform` reads three source and destination points. Each point set may be `3x2C1`, `3x1C2`, or `1x3C2` at F32 or F64 depth. Strided regions are supported. The method rejects non-finite coordinates and collinear source points, then returns a 2x3 single-channel F64 matrix.

`invertAffineTransform` accepts a finite, nonsingular `2x3C1` F32 or F64 matrix, including a strided region, and returns a `2x3C1` F64 inverse.

`getPerspectiveTransform` reads four source and destination points. Each point set may be `4x2C1`, `4x1C2`, or `1x4C2` at F32 or F64 depth. Strided regions are supported. It uses one scaled partial-pivoting solver, fixes the lower-right output coefficient to one, and returns a `3x3C1` F64 matrix. It rejects non-finite values, degenerate point configurations, and transforms that cannot use that normalization.

All four constructors allocate their results. Mutable destination forms and browser differential fixtures remain before these families can move beyond partial status.

The pinned OpenCV.js 4.13.0 browser harness passes worked fixtures for `arcLength`, `contourArea`, `boundingRect`, `isContourConvex`, `pointPolygonTest`, `getStructuringElement`, and `getRotationMatrix2D`. The remaining layouts, modes, invalid inputs, and numeric boundary cases still require differential audit before full-family credit.

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

Reducers compact non-contiguous regions before decoding values. `countNonZero` returns zero for an empty matrix, excludes both signs of zero, and counts NaN, infinities, and subnormal values as non-zero. Floating-point sums, means, and traces propagate NaN. `minMaxLoc` skips NaN and throws when every value is NaN.

### AKAZE configuration

`cv.createAKAZE(options)` allocates a Rust-owned AKAZE configuration handle. The current slice stores configuration only. Feature detection, descriptor extraction, image input, and keypoint output are not implemented yet.

```ts
import { AKAZEDescriptorType, KAZEDiffusivity } from "bun-opencv";

const akaze = cv.createAKAZE({
  descriptorChannels: 3,
  descriptorSize: 0,
  descriptorType: AKAZEDescriptorType.MLDB,
  diffusivity: KAZEDiffusivity.PM_G2,
  maxPoints: -1,
  octaveLayers: 4,
  octaves: 4,
  threshold: 0.001,
});

try {
  akaze.setDescriptorType(cv.AKAZE_DescriptorType.DESCRIPTOR_MLDB_UPRIGHT);
  akaze.setDiffusivity(cv.KAZE_DiffusivityType.DIFF_WEICKERT);
  akaze.setThreshold(0.002);
  console.log(akaze.getDescriptorType(), akaze.getDiffusivity(), akaze.getThreshold());
} finally {
  akaze.dispose();
}
```

Omitting every option uses the OpenCV 4.13 defaults shown above. Factory options are deliberately stricter than instance mutation. Descriptor types accept KAZE upright, KAZE, MLDB upright, or MLDB. Descriptor channels range from 1 through 3, descriptor size is non-negative, octave counts are positive signed 32-bit integers, and thresholds are finite and non-negative. Diffusivity accepts PM G1, PM G2, Weickert, or Charbonnier. `maxPoints` accepts a signed 32-bit integer but has no getter or setter in the pinned AKAZE inventory.

The instance setters reproduce the pinned Embind boundary. Descriptor-channel, descriptor-size, octave, and octave-layer setters coerce numbers to signed i32 and store the complete signed range. The threshold setter preserves the complete F64 domain, including negative zero, `NaN`, and both infinities. Descriptor type and diffusivity setters read a structural object's `value` property and apply JavaScript signed 32-bit conversion. They accept canonical members, foreign enum members, inherited properties, and plain objects. Raw unknown codes remain in Rust-owned state; the matching getter returns `undefined` when no canonical singleton has that code. Missing or extra method arguments throw `BindingError`; unsupported scalar input and integer range failures throw `TypeError`. `getDefaultName()` returns `"Feature2D.AKAZE"`.

The instance exposes OpenCV.js-compatible `delete()` and idempotent `dispose()`. `delete()` releases the handle and a repeated call throws `BindingError`. Every getter or setter after either release path throws `BindingError`.

The pinned OpenCV.js 4.13.0 browser fixture exposes the direct `AKAZE` constructor and all 15 instance methods. The complete compatibility matrix passes for every instance method. It covers exact arity, defaults, return values, scalar coercion, enum namespace descriptors, canonical singleton identity, structural enum inputs, raw unknown wire values, argument errors, and lifetime behavior. Enum getters use const-pointer deletion errors; setters use mutable-pointer deletion errors. The artifact omits the config-listed static `AKAZE.create`, so the package factory has no direct runtime comparator for that baseline.

Call `dispose()` when the handle is no longer needed. Repeated disposal does nothing. Any getter or setter after disposal throws `BindingError`.

### KAZE configuration

`cv.createKAZE(options)` allocates a Rust-owned KAZE configuration handle. It stores detector and descriptor settings but does not accept images, detect keypoints, or compute descriptors yet.

```ts
import { KAZEDiffusivity } from "bun-opencv";

const kaze = cv.createKAZE({
  diffusivity: KAZEDiffusivity.PM_G2,
  extended: false,
  octaveLayers: 4,
  octaves: 4,
  threshold: 0.001,
  upright: false,
});

try {
  kaze.setThreshold(-1);
  kaze.setDiffusivity(cv.KAZE_DiffusivityType.DIFF_CHARBONNIER);
  console.log(kaze.getThreshold(), kaze.getDiffusivity());
} finally {
  kaze.dispose();
}
```

The OpenCV 4.13 defaults are `extended: false`, `upright: false`, threshold `0.0010000000474974513`, four octaves, four octave layers, and `KAZEDiffusivity.PM_G2`. Factory options are deliberately stricter than instance mutation: octave counts must be positive signed 32-bit integers, the threshold must be finite, and diffusivity accepts the typed PM G1, PM G2, Weickert, and Charbonnier enum members.

The instance exposes `getDefaultName()`, getters and setters for every option, OpenCV.js-compatible `delete()`, and idempotent `dispose()`. `getDefaultName()` returns `"Feature2D.KAZE"`. Octave setters coerce numbers to signed i32, threshold preserves the complete F64 domain including negative zero, `NaN`, and both infinities, and boolean setters use JavaScript truthiness. The diffusivity setter reads a structural object's `value` property and stores its signed i32 conversion without validating the code. A raw unknown code makes the getter return `undefined`; known codes return the same canonical singleton used by AKAZE. Missing or extra method arguments throw `BindingError`; unsupported scalar input and integer range failures throw `TypeError`.

`delete()` releases the handle and a repeated call throws `BindingError`, matching OpenCV.js. `dispose()` is the package convenience for idempotent cleanup. Every getter or setter after either release path throws `BindingError`.

The pinned OpenCV.js 4.13.0 browser fixture exposes the direct `KAZE` constructor and all 13 instance methods. The complete compatibility matrix passes for every instance method. It covers exact arity, defaults, return values, scalar coercion, shared enum singleton identity, structural enum inputs, raw unknown wire values, argument errors, and const-getter versus mutable-setter lifetime behavior. The artifact omits the config-listed static `KAZE.create`, so the package factory has no direct static-factory comparator for that baseline.

### AGAST and FAST configuration

`cv.createAgastFeatureDetector(options)` and `cv.createFastFeatureDetector(options)` allocate Rust-owned detector configuration handles. They do not accept images or detect keypoints yet.

```ts
import { AgastFeatureDetectorType, FastFeatureDetectorType } from "bun-opencv";

const agast = cv.createAgastFeatureDetector({
  nonmaxSuppression: true,
  threshold: 10,
  type: AgastFeatureDetectorType.OAST_9_16,
});
const fast = cv.createFastFeatureDetector({
  nonmaxSuppression: true,
  threshold: 10,
  type: FastFeatureDetectorType.TYPE_9_16,
});

try {
  agast.setThreshold(-1);
  agast.setType(cv.AgastFeatureDetector_DetectorType.AGAST_5_8);
  fast.setThreshold(256);
  fast.setType(cv.FastFeatureDetector_DetectorType.TYPE_5_8);
} finally {
  agast.dispose();
  fast.dispose();
}
```

AGAST uses these numeric neighborhood types:

| Enum member                            | Value |
| -------------------------------------- | ----: |
| `AgastFeatureDetectorType.AGAST_5_8`   |     0 |
| `AgastFeatureDetectorType.AGAST_7_12d` |     1 |
| `AgastFeatureDetectorType.AGAST_7_12s` |     2 |
| `AgastFeatureDetectorType.OAST_9_16`   |     3 |

FAST uses these numeric neighborhood types:

| Enum member                         | Value |
| ----------------------------------- | ----: |
| `FastFeatureDetectorType.TYPE_5_8`  |     0 |
| `FastFeatureDetectorType.TYPE_7_12` |     1 |
| `FastFeatureDetectorType.TYPE_9_16` |     2 |

Both factories default to threshold `10` with non-maximum suppression enabled. AGAST defaults to `OAST_9_16`, and FAST defaults to `TYPE_9_16`. `getDefaultName()` returns `"Feature2D.AgastFeatureDetector"` or `"Feature2D.FastFeatureDetector"`.

`setThreshold(value)` follows the pinned binding's signed i32 coercion and returns `undefined`. Fractional values truncate toward zero, and `NaN` becomes zero. The browser differential fixture also confirms that AGAST preserves `-1` and FAST preserves `256`. `setNonmaxSuppression(value)` applies JavaScript boolean coercion and returns `undefined`.

The five primitive methods on each class, `getDefaultName`, `getNonmaxSuppression`, `getThreshold`, `setNonmaxSuppression`, and `setThreshold`, enforce the pinned argument counts. Missing setter arguments and extra getter or setter arguments throw `BindingError`. `delete()` returns `undefined`; a second deletion and every primitive method call after deletion also throw `BindingError`. The package keeps idempotent `dispose()` as a convenience.

`getType()` returns the canonical Embind-compatible singleton for known codes. `setType(value)` reads a structural object's `value` property and stores its JavaScript signed 32-bit conversion. This accepts canonical or foreign enum members, inherited properties, plain objects, fractions, non-finite numbers, strings, and booleans with the same observable conversion as the pinned binding. Unknown raw codes remain in Rust-owned state and make the getter return `undefined`. Nullish inputs and throwing property getters propagate the matching errors without mutating state.

The pinned OpenCV.js 4.13.0 artifact exposes direct `AgastFeatureDetector` and `FastFeatureDetector` constructors and all seven instance methods on both. Every instance method passes the complete call-contract matrix, including enum namespace descriptors, canonical singleton identity, structural setter coercion, raw unknown wire values, exact arity, and const-getter versus mutable-setter lifetime errors. The factories remain partial because the artifact omits both config-listed static `create` methods.

### GFTT detector configuration

`cv.createGFTTDetector(options)` allocates a Rust-owned good-features-to-track detector configuration. This slice stores settings only. It does not accept images or detect keypoints.

```ts
const detector = cv.createGFTTDetector({
  blockSize: 3,
  k: 0.04,
  maxFeatures: 1_000,
  minDistance: 1,
  qualityLevel: 0.01,
  useHarrisDetector: false,
});

try {
  detector.setMaxFeatures(-1);
  detector.setQualityLevel(Number.POSITIVE_INFINITY);
  console.log(detector.getMaxFeatures(), detector.getQualityLevel());
} finally {
  detector.dispose();
}
```

Omitting options uses the exact OpenCV 4.13 defaults shown above. Factory options remain strictly typed and validate `maxFeatures` and `blockSize` as signed 32-bit integers.

The 13 instance methods match the pinned OpenCV.js binding contract. Every getter requires zero arguments, and every setter requires exactly one. Missing or extra arguments throw `BindingError`. `getDefaultName()` returns `"Feature2D.GFTTDetector"`.

The integer setters follow Embind's JavaScript coercion behavior. Numeric fractions truncate to signed i32, `NaN` becomes `0`, and booleans become `1` or `0`. Numbers outside the signed 32-bit range, infinity, strings, `null`, and `undefined` throw `TypeError`. The F64 setters preserve every number, including `NaN` and both infinities, and convert booleans to `1` or `0`. Other F64 inputs throw `TypeError`. `setHarrisDetector()` applies JavaScript truthiness through `Boolean(value)`.

Each setter returns `undefined`. Call `delete()` for OpenCV.js-compatible ownership. The first call returns `undefined`; a repeated call throws `BindingError`. Getters and setters also throw `BindingError` after deletion, with the pinned mutable or const pointer message. The package also keeps `dispose()` as an idempotent convenience.

The pinned OpenCV.js 4.13.0 fixture exposes the direct `GFTTDetector` constructor and all 13 instance methods. The browser matrix verifies method arity, defaults, return values, scalar coercion, missing and extra arguments, deletion, repeat deletion, and calls after deletion. All 13 instance methods count as implemented. The artifact omits the config-listed static `GFTTDetector.create` method. The package factory remains partial because it supports one six-argument shape and omits the `gradientSize` overload.

## Errors

The TypeScript boundary throws `OpenCvInputError` for invalid dimensions, byte lengths, thresholds, and strictly validated factory options. Audited detector instance methods throw `BindingError` for argument-count and deleted-object failures, matching the pinned browser binding. Their scalar and enum-object boundary failures throw `TypeError` where the pinned binding does. Rust rejects invalid dimensions and byte lengths if a caller bypasses the TypeScript client.

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
