import {
  createRgbaImage,
  validateDimension,
  validateRgbaImage,
  validateThreshold,
} from "./image.js";
import { Mat, validateMatrixDimension, validateMatrixInput } from "./mat.js";
import type { OpenCv, OpenCvBackend, RgbaImage } from "./types.js";

class WasmOpenCv implements OpenCv {
  readonly #backend: OpenCvBackend;

  constructor(backend: OpenCvBackend) {
    this.#backend = backend;
  }

  grayscale(image: RgbaImage): RgbaImage {
    validateRgbaImage(image);
    const data = this.#backend.grayscaleRgba(image.data, image.width, image.height);
    return createRgbaImage(image.width, image.height, data);
  }

  invert(image: RgbaImage): RgbaImage {
    validateRgbaImage(image);
    const data = this.#backend.invertRgba(image.data, image.width, image.height);
    return createRgbaImage(image.width, image.height, data);
  }

  matFromU8(rows: number, columns: number, channels: number, data: Uint8Array): Mat {
    validateMatrixInput(rows, columns, channels, data.byteLength);
    return new Mat(this.#backend.matFromU8(data, rows, columns, channels));
  }

  resizeNearest(image: RgbaImage, targetWidth: number, targetHeight: number): RgbaImage {
    validateRgbaImage(image);
    validateDimension(targetWidth, "targetWidth");
    validateDimension(targetHeight, "targetHeight");
    const data = this.#backend.resizeNearestRgba(
      image.data,
      image.width,
      image.height,
      targetWidth,
      targetHeight,
    );
    return createRgbaImage(targetWidth, targetHeight, data);
  }

  threshold(image: RgbaImage, threshold: number): RgbaImage {
    validateRgbaImage(image);
    validateThreshold(threshold);
    const data = this.#backend.thresholdRgba(image.data, image.width, image.height, threshold);
    return createRgbaImage(image.width, image.height, data);
  }

  zerosU8(rows: number, columns: number, channels: number): Mat {
    validateMatrixDimension(rows, "rows");
    validateMatrixDimension(columns, "columns");
    validateMatrixInput(rows, columns, channels, rows * columns * channels);
    return new Mat(this.#backend.matZerosU8(rows, columns, channels));
  }
}

/** Creates a client from a compatible backend. Most callers should use `initOpenCv`. */
export function createOpenCv(backend: OpenCvBackend): OpenCv {
  return new WasmOpenCv(backend);
}
