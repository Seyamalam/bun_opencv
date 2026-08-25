import type { Mat, WasmMatHandle } from "./mat.js";

/** An RGBA image whose data contains four bytes per pixel. */
export interface RgbaImage {
  readonly data: Uint8Array;
  readonly height: number;
  readonly width: number;
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
  matAbsdiffU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matAddU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matBitwiseAndU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matBitwiseNotU8(source: WasmMatHandle): WasmMatHandle;
  matBitwiseOrU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matBitwiseXorU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matCompareEqU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matCountNonZeroU8(source: WasmMatHandle): number;
  matInRangeU8(
    source: WasmMatHandle,
    lowerBound: WasmMatHandle,
    upperBound: WasmMatHandle,
  ): WasmMatHandle;
  matMaxU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matMinU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
  matSubtractU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle;
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
  max(left: Mat, right: Mat): Mat;
  min(left: Mat, right: Mat): Mat;
  resizeNearest(image: RgbaImage, targetWidth: number, targetHeight: number): RgbaImage;
  threshold(image: RgbaImage, threshold: number): RgbaImage;
  subtract(left: Mat, right: Mat): Mat;
  zerosF32(rows: number, columns: number, channels: number): Mat;
  zerosF64(rows: number, columns: number, channels: number): Mat;
  zerosI16(rows: number, columns: number, channels: number): Mat;
  zerosI32(rows: number, columns: number, channels: number): Mat;
  zerosI8(rows: number, columns: number, channels: number): Mat;
  zerosU16(rows: number, columns: number, channels: number): Mat;
  zerosU8(rows: number, columns: number, channels: number): Mat;
}
