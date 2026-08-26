import type { Mat, WasmMatHandle } from "./mat.js";

/** An RGBA image whose data contains four bytes per pixel. */
export interface RgbaImage {
  readonly data: Uint8Array;
  readonly height: number;
  readonly width: number;
}

/** Four-channel scalar result used by OpenCV reductions. */
export type Scalar = readonly [number, number, number, number];

/** Zero-based matrix coordinate. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Extrema and first row-major locations returned by `minMaxLoc`. */
export interface MinMaxLocation {
  readonly maxLoc: Point;
  readonly maxVal: number;
  readonly minLoc: Point;
  readonly minVal: number;
}

/** Low-level contract implemented by the generated WebAssembly module. */
export interface OpenCvBackend {
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
  matInRangeU8(
    source: WasmMatHandle,
    lowerBound: WasmMatHandle,
    upperBound: WasmMatHandle,
  ): WasmMatHandle;
  matSplit(source: WasmMatHandle): WasmMatHandle[];
  matMerge(first: WasmMatHandle, second: WasmMatHandle): WasmMatHandle;
  matMerge3(first: WasmMatHandle, second: WasmMatHandle, third: WasmMatHandle): WasmMatHandle;
  matMerge4(
    first: WasmMatHandle,
    second: WasmMatHandle,
    third: WasmMatHandle,
    fourth: WasmMatHandle,
  ): WasmMatHandle;
  matExtractChannel(source: WasmMatHandle, channel: number): WasmMatHandle;
  matInsertChannel(source: WasmMatHandle, destination: WasmMatHandle, channel: number): void;
  matMaxU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matMean(source: WasmMatHandle): Float64Array;
  matMinMaxLoc(source: WasmMatHandle): Float64Array;
  matMinU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matSubtractU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matSum(source: WasmMatHandle): Float64Array;
  matTranspose(source: WasmMatHandle): WasmMatHandle;
  matTransposeInto(source: WasmMatHandle, destination: WasmMatHandle): void;
  matTrace(source: WasmMatHandle): number;
  matZerosF32(rows: number, columns: number, channels: number): WasmMatHandle;
  matZerosF64(rows: number, columns: number, channels: number): WasmMatHandle;
  matZerosI16(rows: number, columns: number, channels: number): WasmMatHandle;
  matZerosI32(rows: number, columns: number, channels: number): WasmMatHandle;
  matZerosI8(rows: number, columns: number, channels: number): WasmMatHandle;
  matZerosU16(rows: number, columns: number, channels: number): WasmMatHandle;
  matZerosU8(rows: number, columns: number, channels: number): WasmMatHandle;
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
  bitwiseAnd(left: Mat, right: Mat): Mat;
  bitwiseNot(source: Mat): Mat;
  bitwiseOr(left: Mat, right: Mat): Mat;
  bitwiseXor(left: Mat, right: Mat): Mat;
  compareEqual(left: Mat, right: Mat): Mat;
  countNonZero(source: Mat): number;
  extractChannel(source: Mat, channel: number): Mat;
  flip(source: Mat, flipCode: -1 | 0 | 1): Mat;
  flip(source: Mat, destination: Mat, flipCode: -1 | 0 | 1): void;
  grayscale(image: RgbaImage): RgbaImage;
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
  max(left: Mat, right: Mat): Mat;
  mean(source: Mat): Scalar;
  merge(
    sources: readonly [Mat, Mat] | readonly [Mat, Mat, Mat] | readonly [Mat, Mat, Mat, Mat],
  ): Mat;
  minMaxLoc(source: Mat): MinMaxLocation;
  min(left: Mat, right: Mat): Mat;
  resizeNearest(image: RgbaImage, targetWidth: number, targetHeight: number): RgbaImage;
  repeat(source: Mat, rowRepeats: number, columnRepeats: number): Mat;
  repeat(source: Mat, rowRepeats: number, columnRepeats: number, destination: Mat): void;
  rotate(source: Mat, rotateCode: 0 | 1 | 2): Mat;
  rotate(source: Mat, destination: Mat, rotateCode: 0 | 1 | 2): void;
  threshold(image: RgbaImage, threshold: number): RgbaImage;
  subtract(left: Mat, right: Mat): Mat;
  split(source: Mat): Mat[];
  sum(source: Mat): Scalar;
  transpose(source: Mat): Mat;
  transpose(source: Mat, destination: Mat): void;
  trace(source: Mat): number;
  zerosF32(rows: number, columns: number, channels: number): Mat;
  zerosF64(rows: number, columns: number, channels: number): Mat;
  zerosI16(rows: number, columns: number, channels: number): Mat;
  zerosI32(rows: number, columns: number, channels: number): Mat;
  zerosI8(rows: number, columns: number, channels: number): Mat;
  zerosU16(rows: number, columns: number, channels: number): Mat;
  zerosU8(rows: number, columns: number, channels: number): Mat;
}
