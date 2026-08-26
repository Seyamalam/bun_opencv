import type { AKAZE, AKAZEOptions, WasmAKAZEFactory } from "./akaze.js";
import type { Mat, WasmMatHandle } from "./mat.js";

/** An RGBA image whose data contains four bytes per pixel. */
export interface RgbaImage {
  readonly data: Uint8Array;
  readonly height: number;
  readonly width: number;
}

/** Four-channel scalar result used by OpenCV reductions. */
export type Scalar = readonly [number, number, number, number];

/** OpenCV-compatible border mode, optionally combined with the isolated bit. */
export type BorderType = 0 | 1 | 2 | 3 | 4 | 16 | 17 | 18 | 19 | 20;

/** Supported OpenCV numeric, binary, and relative norm flags. */
export type NormType = 1 | 2 | 4 | 5 | 6 | 7 | 9 | 10 | 12 | 13;

/** Norm modes accepted by normalization. */
export type NormalizeType = 1 | 2 | 4 | 32;

/** OpenCV reduce mode: sum, average, maximum, or minimum. */
export type ReduceKind = 0 | 1 | 2 | 3;

/** Implemented dense decomposition methods: LU, Cholesky, or QR. */
export type DecompositionMethod = 0 | 3 | 4;

/** Zero-based matrix coordinate. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Positive two-dimensional extent. */
export interface Size {
  readonly height: number;
  readonly width: number;
}

/** Integer rectangle with an inclusive pixel extent. */
export interface Rect extends Size, Point {}

/** Structuring-element kind: rectangle, cross, or ellipse. */
export type StructuringElementKind = 0 | 1 | 2;

/** Floating-point depths supported by Hanning windows. */
export type HanningWindowDepth = "f32" | "f64";

/** OpenCV-compatible log severity from silent through verbose. */
export type LogLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Extrema and first row-major locations returned by `minMaxLoc`. */
export interface MinMaxLocation {
  readonly maxLoc: Point;
  readonly maxVal: number;
  readonly minLoc: Point;
  readonly minVal: number;
}

/** Low-level contract implemented by the generated WebAssembly module. */
export interface OpenCvBackend {
  readonly AKAZE: WasmAKAZEFactory;
  clipLine(
    rectangleX: number,
    rectangleY: number,
    rectangleWidth: number,
    rectangleHeight: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): Int32Array;
  createHanningWindow(columns: number, rows: number, depth: number): WasmMatHandle;
  ellipse2Poly(
    centerX: number,
    centerY: number,
    axisX: number,
    axisY: number,
    rotationDegrees: number,
    arcStart: number,
    arcEnd: number,
    delta: number,
  ): Int32Array;
  getStructuringElement(
    kind: number,
    columns: number,
    rows: number,
    anchorX: number,
    anchorY: number,
  ): WasmMatHandle;
  getLogLevel(): number;
  getOptimalDFTSize(size: number): number;
  grayscaleRgba(data: Uint8Array, width: number, height: number): Uint8Array;
  invertRgba(data: Uint8Array, width: number, height: number): Uint8Array;
  matFromF32(data: Float32Array, rows: number, columns: number, channels: number): WasmMatHandle;
  matFromF64(data: Float64Array, rows: number, columns: number, channels: number): WasmMatHandle;
  matFromI16(data: Int16Array, rows: number, columns: number, channels: number): WasmMatHandle;
  matFromI32(data: Int32Array, rows: number, columns: number, channels: number): WasmMatHandle;
  matFromI8(data: Int8Array, rows: number, columns: number, channels: number): WasmMatHandle;
  matFromU16(data: Uint16Array, rows: number, columns: number, channels: number): WasmMatHandle;
  matFromU8(data: Uint8Array, rows: number, columns: number, channels: number): WasmMatHandle;
  matFlip(source: WasmMatHandle, flipCode: number): WasmMatHandle;
  matFlipInto(source: WasmMatHandle, destination: WasmMatHandle, flipCode: number): void;
  matRotate(source: WasmMatHandle, rotateCode: number): WasmMatHandle;
  matRotateInto(source: WasmMatHandle, destination: WasmMatHandle, rotateCode: number): void;
  matRepeat(source: WasmMatHandle, rowRepeats: number, columnRepeats: number): WasmMatHandle;
  matRepeatInto(
    source: WasmMatHandle,
    destination: WasmMatHandle,
    rowRepeats: number,
    columnRepeats: number,
  ): void;
  matAbsdiffU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matAddU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matBitwiseAndU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matBitwiseNotU8(source: WasmMatHandle): WasmMatHandle;
  matBitwiseOrU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matBitwiseXorU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matCompareEqU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matCountNonZero(source: WasmMatHandle): number;
  matDeterminant(source: WasmMatHandle): number;
  matArcLength(contour: WasmMatHandle, closed: boolean): number;
  matBoundingRect(contour: WasmMatHandle): Int32Array;
  matContourArea(contour: WasmMatHandle, oriented: boolean): number;
  matInRangeU8(
    source: WasmMatHandle,
    lowerBound: WasmMatHandle,
    upperBound: WasmMatHandle,
  ): WasmMatHandle;
  matGetAffineTransform(source: WasmMatHandle, destination: WasmMatHandle): WasmMatHandle;
  matGetPerspectiveTransform(source: WasmMatHandle, destination: WasmMatHandle): WasmMatHandle;
  matGetRotationMatrix2D(
    centerX: number,
    centerY: number,
    angleDegrees: number,
    scale: number,
  ): WasmMatHandle;
  matInvertAffineTransform(transform: WasmMatHandle): WasmMatHandle;
  matInvertInto(source: WasmMatHandle, destination: WasmMatHandle, method: number): number;
  matIsContourConvex(contour: WasmMatHandle): boolean;
  matSplit(source: WasmMatHandle): WasmMatHandle[];
  matMerge(first: WasmMatHandle, second: WasmMatHandle): WasmMatHandle;
  matMerge3(first: WasmMatHandle, second: WasmMatHandle, third: WasmMatHandle): WasmMatHandle;
  matMerge4(
    first: WasmMatHandle,
    second: WasmMatHandle,
    third: WasmMatHandle,
    fourth: WasmMatHandle,
  ): WasmMatHandle;
  matMixChannels(source: WasmMatHandle, destination: WasmMatHandle, fromTo: Uint16Array): void;
  matExtractChannel(source: WasmMatHandle, channel: number): WasmMatHandle;
  matInsertChannel(source: WasmMatHandle, destination: WasmMatHandle, channel: number): void;
  matLut(source: WasmMatHandle, table: WasmMatHandle): WasmMatHandle;
  matLutInto(source: WasmMatHandle, table: WasmMatHandle, destination: WasmMatHandle): void;
  matNorm(source: WasmMatHandle, normType: number): number;
  matNormMasked(source: WasmMatHandle, normType: number, mask: WasmMatHandle): number;
  matNormDiff(first: WasmMatHandle, second: WasmMatHandle, normType: number): number;
  matNormDiffMasked(
    first: WasmMatHandle,
    second: WasmMatHandle,
    normType: number,
    mask: WasmMatHandle,
  ): number;
  matNormalizeInto(
    source: WasmMatHandle,
    destination: WasmMatHandle,
    alpha: number,
    beta: number,
    normType: number,
  ): void;
  matNormalizeMaskedInto(
    source: WasmMatHandle,
    destination: WasmMatHandle,
    alpha: number,
    beta: number,
    normType: number,
    mask: WasmMatHandle,
  ): void;
  matMeanStdDevInto(
    source: WasmMatHandle,
    means: WasmMatHandle,
    standardDeviations: WasmMatHandle,
  ): void;
  matMeanStdDevMaskedInto(
    source: WasmMatHandle,
    means: WasmMatHandle,
    standardDeviations: WasmMatHandle,
    mask: WasmMatHandle,
  ): void;
  matReduceInto(
    source: WasmMatHandle,
    destination: WasmMatHandle,
    axis: number,
    kind: number,
  ): void;
  matRandn(destination: WasmMatHandle, mean: Float64Array, standardDeviation: Float64Array): void;
  matRandu(destination: WasmMatHandle, lower: Float64Array, upper: Float64Array): void;
  matSetIdentity(destination: WasmMatHandle, value: Float64Array): void;
  matSolveInto(
    coefficients: WasmMatHandle,
    rightHandSides: WasmMatHandle,
    destination: WasmMatHandle,
    method: number,
  ): boolean;
  matHconcat2(first: WasmMatHandle, second: WasmMatHandle): WasmMatHandle;
  matHconcat3(first: WasmMatHandle, second: WasmMatHandle, third: WasmMatHandle): WasmMatHandle;
  matHconcat4(
    first: WasmMatHandle,
    second: WasmMatHandle,
    third: WasmMatHandle,
    fourth: WasmMatHandle,
  ): WasmMatHandle;
  matVconcat2(first: WasmMatHandle, second: WasmMatHandle): WasmMatHandle;
  matVconcat3(first: WasmMatHandle, second: WasmMatHandle, third: WasmMatHandle): WasmMatHandle;
  matVconcat4(
    first: WasmMatHandle,
    second: WasmMatHandle,
    third: WasmMatHandle,
    fourth: WasmMatHandle,
  ): WasmMatHandle;
  matExp(source: WasmMatHandle): WasmMatHandle;
  matLog(source: WasmMatHandle): WasmMatHandle;
  matSqrt(source: WasmMatHandle): WasmMatHandle;
  matPow(source: WasmMatHandle, exponent: number): WasmMatHandle;
  matMagnitude(x: WasmMatHandle, y: WasmMatHandle): WasmMatHandle;
  matCartToPolar(
    x: WasmMatHandle,
    y: WasmMatHandle,
    magnitude: WasmMatHandle,
    angle: WasmMatHandle,
    degrees: boolean,
  ): void;
  matPolarToCart(
    magnitude: WasmMatHandle,
    angle: WasmMatHandle,
    x: WasmMatHandle,
    y: WasmMatHandle,
    degrees: boolean,
  ): void;
  matMultiply(a: WasmMatHandle, b: WasmMatHandle, scale: number): WasmMatHandle;
  matMultiplyInto(
    a: WasmMatHandle,
    b: WasmMatHandle,
    destination: WasmMatHandle,
    scale: number,
  ): void;
  matDivide(a: WasmMatHandle, b: WasmMatHandle, scale: number): WasmMatHandle;
  matDivideInto(
    a: WasmMatHandle,
    b: WasmMatHandle,
    destination: WasmMatHandle,
    scale: number,
  ): void;
  matAddWeighted(
    a: WasmMatHandle,
    alpha: number,
    b: WasmMatHandle,
    beta: number,
    gamma: number,
  ): WasmMatHandle;
  matAddWeightedInto(
    a: WasmMatHandle,
    alpha: number,
    b: WasmMatHandle,
    beta: number,
    gamma: number,
    destination: WasmMatHandle,
  ): void;
  matConvertScaleAbs(source: WasmMatHandle, alpha: number, beta: number): WasmMatHandle;
  matConvertScaleAbsInto(
    source: WasmMatHandle,
    destination: WasmMatHandle,
    alpha: number,
    beta: number,
  ): void;
  matCopyMakeBorder(
    source: WasmMatHandle,
    top: number,
    bottom: number,
    left: number,
    right: number,
    borderType: number,
    constant: Float64Array,
  ): WasmMatHandle;
  matCopyMakeBorderInto(
    source: WasmMatHandle,
    destination: WasmMatHandle,
    top: number,
    bottom: number,
    left: number,
    right: number,
    borderType: number,
    constant: Float64Array,
  ): void;
  matMaxU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matMean(source: WasmMatHandle): Float64Array;
  matMinMaxLoc(source: WasmMatHandle): Float64Array;
  matMinU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matSubtractU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matSum(source: WasmMatHandle): Float64Array;
  matTranspose(source: WasmMatHandle): WasmMatHandle;
  matTransposeInto(source: WasmMatHandle, destination: WasmMatHandle): void;
  matTrace(source: WasmMatHandle): number;
  matTransform(source: WasmMatHandle, coefficients: WasmMatHandle): WasmMatHandle;
  matTransformInto(
    source: WasmMatHandle,
    coefficients: WasmMatHandle,
    destination: WasmMatHandle,
  ): void;
  matPerspectiveTransform(source: WasmMatHandle, coefficients: WasmMatHandle): WasmMatHandle;
  matPerspectiveTransformInto(
    source: WasmMatHandle,
    coefficients: WasmMatHandle,
    destination: WasmMatHandle,
  ): void;
  matPointPolygonTest(
    contour: WasmMatHandle,
    x: number,
    y: number,
    measureDistance: boolean,
  ): number;
  matZerosF32(rows: number, columns: number, channels: number): WasmMatHandle;
  matZerosF64(rows: number, columns: number, channels: number): WasmMatHandle;
  matZerosI16(rows: number, columns: number, channels: number): WasmMatHandle;
  matZerosI32(rows: number, columns: number, channels: number): WasmMatHandle;
  matZerosI8(rows: number, columns: number, channels: number): WasmMatHandle;
  matZerosU16(rows: number, columns: number, channels: number): WasmMatHandle;
  matZerosU8(rows: number, columns: number, channels: number): WasmMatHandle;
  setRNGSeed(seed: number): void;
  setLogLevel(level: number): number;
  resizeNearestRgba(
    data: Uint8Array,
    width: number,
    height: number,
    targetWidth: number,
    targetHeight: number,
  ): Uint8Array;
  thresholdRgba(data: Uint8Array, width: number, height: number, threshold: number): Uint8Array;
}

/** Initialized image processing client. */
export interface OpenCv {
  absdiff(left: Mat, right: Mat): Mat;
  add(left: Mat, right: Mat): Mat;
  addWeighted(a: Mat, alpha: number, b: Mat, beta: number, gamma: number): Mat;
  addWeighted(a: Mat, alpha: number, b: Mat, beta: number, gamma: number, destination: Mat): void;
  bitwiseAnd(left: Mat, right: Mat): Mat;
  bitwiseNot(source: Mat): Mat;
  bitwiseOr(left: Mat, right: Mat): Mat;
  bitwiseXor(left: Mat, right: Mat): Mat;
  arcLength(contour: Mat, closed: boolean): number;
  boundingRect(contour: Mat): Rect;
  clipLine(rectangle: Rect, start: Point, end: Point): readonly [Point, Point] | undefined;
  compareEqual(left: Mat, right: Mat): Mat;
  cartToPolar(x: Mat, y: Mat, magnitude: Mat, angle: Mat, degrees?: boolean): void;
  countNonZero(source: Mat): number;
  contourArea(contour: Mat, oriented?: boolean): number;
  createHanningWindow(size: Size, depth: HanningWindowDepth): Mat;
  createAKAZE(options?: AKAZEOptions): AKAZE;
  determinant(source: Mat): number;
  convertScaleAbs(source: Mat, alpha?: number, beta?: number): Mat;
  convertScaleAbs(source: Mat, destination: Mat, alpha?: number, beta?: number): void;
  copyMakeBorder(
    source: Mat,
    top: number,
    bottom: number,
    left: number,
    right: number,
    borderType: BorderType,
    constant?: Scalar,
  ): Mat;
  divide(a: Mat, b: Mat, scale?: number): Mat;
  divide(a: Mat, b: Mat, destination: Mat, scale?: number): void;
  extractChannel(source: Mat, channel: number): Mat;
  ellipse2Poly(
    center: Point,
    axes: Size,
    rotationDegrees: number,
    arcStart: number,
    arcEnd: number,
    delta: number,
  ): Point[];
  exp(source: Mat): Mat;
  flip(source: Mat, flipCode: -1 | 0 | 1): Mat;
  flip(source: Mat, destination: Mat, flipCode: -1 | 0 | 1): void;
  grayscale(image: RgbaImage): RgbaImage;
  hconcat(
    sources: readonly [Mat, Mat] | readonly [Mat, Mat, Mat] | readonly [Mat, Mat, Mat, Mat],
  ): Mat;
  getAffineTransform(source: Mat, destination: Mat): Mat;
  getLogLevel(): LogLevel;
  getOptimalDFTSize(size: number): number;
  getPerspectiveTransform(source: Mat, destination: Mat): Mat;
  getRotationMatrix2D(center: Point, angleDegrees: number, scale: number): Mat;
  getStructuringElement(kind: StructuringElementKind, size: Size, anchor?: Point): Mat;
  invert(image: RgbaImage): RgbaImage;
  matFromF32(rows: number, columns: number, channels: number, data: Float32Array): Mat;
  matFromF64(rows: number, columns: number, channels: number, data: Float64Array): Mat;
  matFromI16(rows: number, columns: number, channels: number, data: Int16Array): Mat;
  matFromI32(rows: number, columns: number, channels: number, data: Int32Array): Mat;
  matFromI8(rows: number, columns: number, channels: number, data: Int8Array): Mat;
  matFromU16(rows: number, columns: number, channels: number, data: Uint16Array): Mat;
  matFromU8(rows: number, columns: number, channels: number, data: Uint8Array): Mat;
  inRange(source: Mat, lowerBound: Mat, upperBound: Mat): Mat;
  insertChannel(source: Mat, destination: Mat, channel: number): void;
  invertAffineTransform(transform: Mat): Mat;
  isContourConvex(contour: Mat): boolean;
  invert(source: Mat, destination: Mat, method?: DecompositionMethod): number;
  log(source: Mat): Mat;
  lut(source: Mat, table: Mat): Mat;
  lut(source: Mat, table: Mat, destination: Mat): void;
  magnitude(x: Mat, y: Mat): Mat;
  max(left: Mat, right: Mat): Mat;
  mean(source: Mat): Scalar;
  meanStdDev(source: Mat, means: Mat, standardDeviations: Mat, mask?: Mat): void;
  merge(
    sources: readonly [Mat, Mat] | readonly [Mat, Mat, Mat] | readonly [Mat, Mat, Mat, Mat],
  ): Mat;
  minMaxLoc(source: Mat): MinMaxLocation;
  min(left: Mat, right: Mat): Mat;
  mixChannels(source: Mat, destination: Mat, fromTo: Uint16Array): void;
  multiply(a: Mat, b: Mat, scale?: number): Mat;
  multiply(a: Mat, b: Mat, destination: Mat, scale?: number): void;
  norm(source: Mat, normType?: NormType, mask?: Mat): number;
  norm(first: Mat, second: Mat, normType?: NormType, mask?: Mat): number;
  normalize(
    source: Mat,
    destination: Mat,
    alpha: number,
    beta: number,
    normType: NormalizeType,
    mask?: Mat,
  ): void;
  polarToCart(magnitude: Mat, angle: Mat, x: Mat, y: Mat, degrees?: boolean): void;
  pointPolygonTest(contour: Mat, point: Point, measureDistance: boolean): number;
  perspectiveTransform(source: Mat, coefficients: Mat): Mat;
  perspectiveTransform(source: Mat, coefficients: Mat, destination: Mat): void;
  pow(source: Mat, exponent: number): Mat;
  randn(destination: Mat, mean: Scalar, standardDeviation: Scalar): void;
  randu(destination: Mat, lower: Scalar, upper: Scalar): void;
  resizeNearest(image: RgbaImage, targetWidth: number, targetHeight: number): RgbaImage;
  repeat(source: Mat, rowRepeats: number, columnRepeats: number): Mat;
  repeat(source: Mat, rowRepeats: number, columnRepeats: number, destination: Mat): void;
  rotate(source: Mat, rotateCode: 0 | 1 | 2): Mat;
  rotate(source: Mat, destination: Mat, rotateCode: 0 | 1 | 2): void;
  setIdentity(destination: Mat, value?: Scalar): void;
  setLogLevel(level: LogLevel): LogLevel;
  setRNGSeed(seed: number): void;
  solve(
    coefficients: Mat,
    rightHandSides: Mat,
    destination: Mat,
    method?: DecompositionMethod,
  ): boolean;
  reduce(source: Mat, destination: Mat, axis: 0 | 1, kind: ReduceKind): void;
  threshold(image: RgbaImage, threshold: number): RgbaImage;
  subtract(left: Mat, right: Mat): Mat;
  split(source: Mat): Mat[];
  sqrt(source: Mat): Mat;
  sum(source: Mat): Scalar;
  transpose(source: Mat): Mat;
  transpose(source: Mat, destination: Mat): void;
  trace(source: Mat): number;
  transform(source: Mat, coefficients: Mat): Mat;
  transform(source: Mat, coefficients: Mat, destination: Mat): void;
  vconcat(
    sources: readonly [Mat, Mat] | readonly [Mat, Mat, Mat] | readonly [Mat, Mat, Mat, Mat],
  ): Mat;
  zerosF32(rows: number, columns: number, channels: number): Mat;
  zerosF64(rows: number, columns: number, channels: number): Mat;
  zerosI16(rows: number, columns: number, channels: number): Mat;
  zerosI32(rows: number, columns: number, channels: number): Mat;
  zerosI8(rows: number, columns: number, channels: number): Mat;
  zerosU16(rows: number, columns: number, channels: number): Mat;
  zerosU8(rows: number, columns: number, channels: number): Mat;
}
