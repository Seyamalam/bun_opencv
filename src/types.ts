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
  matFromU8(data: Uint8Array, rows: number, columns: number, channels: number): WasmMatHandle;
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
  grayscale(image: RgbaImage): RgbaImage;
  invert(image: RgbaImage): RgbaImage;
  matFromU8(rows: number, columns: number, channels: number, data: Uint8Array): Mat;
  resizeNearest(image: RgbaImage, targetWidth: number, targetHeight: number): RgbaImage;
  threshold(image: RgbaImage, threshold: number): RgbaImage;
  zerosU8(rows: number, columns: number, channels: number): Mat;
}
