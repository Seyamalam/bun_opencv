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

  absdiff(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matAbsdiffU8(left.handleForBackend(), right.handleForBackend()));
  }

  add(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matAddU8(left.handleForBackend(), right.handleForBackend()));
  }

  bitwiseAnd(left: Mat, right: Mat): Mat {
    return new Mat(
      this.#backend.matBitwiseAndU8(left.handleForBackend(), right.handleForBackend()),
    );
  }

  bitwiseNot(source: Mat): Mat {
    return new Mat(this.#backend.matBitwiseNotU8(source.handleForBackend()));
  }

  bitwiseOr(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matBitwiseOrU8(left.handleForBackend(), right.handleForBackend()));
  }

  bitwiseXor(left: Mat, right: Mat): Mat {
    return new Mat(
      this.#backend.matBitwiseXorU8(left.handleForBackend(), right.handleForBackend()),
    );
  }

  compareEqual(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matCompareEqU8(left.handleForBackend(), right.handleForBackend()));
  }

  countNonZero(source: Mat): number {
    return this.#backend.matCountNonZeroU8(source.handleForBackend());
  }

  flip(source: Mat, flipCode: -1 | 0 | 1): Mat {
    return new Mat(this.#backend.matFlip(source.handleForBackend(), flipCode));
  }

  rotate(source: Mat, rotateCode: 0 | 1 | 2): Mat {
    return new Mat(this.#backend.matRotate(source.handleForBackend(), rotateCode));
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

  matFromF32(rows: number, columns: number, channels: number, data: Float32Array): Mat {
    validateMatrixInput(rows, columns, channels, data.byteLength, Float32Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matFromF32(data, rows, columns, channels));
  }

  matFromF64(rows: number, columns: number, channels: number, data: Float64Array): Mat {
    validateMatrixInput(rows, columns, channels, data.byteLength, Float64Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matFromF64(data, rows, columns, channels));
  }

  matFromI16(rows: number, columns: number, channels: number, data: Int16Array): Mat {
    validateMatrixInput(rows, columns, channels, data.byteLength, Int16Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matFromI16(data, rows, columns, channels));
  }

  matFromI32(rows: number, columns: number, channels: number, data: Int32Array): Mat {
    validateMatrixInput(rows, columns, channels, data.byteLength, Int32Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matFromI32(data, rows, columns, channels));
  }

  matFromI8(rows: number, columns: number, channels: number, data: Int8Array): Mat {
    validateMatrixInput(rows, columns, channels, data.byteLength, Int8Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matFromI8(data, rows, columns, channels));
  }

  matFromU16(rows: number, columns: number, channels: number, data: Uint16Array): Mat {
    validateMatrixInput(rows, columns, channels, data.byteLength, Uint16Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matFromU16(data, rows, columns, channels));
  }

  matFromU8(rows: number, columns: number, channels: number, data: Uint8Array): Mat {
    validateMatrixInput(rows, columns, channels, data.byteLength);
    return new Mat(this.#backend.matFromU8(data, rows, columns, channels));
  }

  inRange(source: Mat, lowerBound: Mat, upperBound: Mat): Mat {
    return new Mat(
      this.#backend.matInRangeU8(
        source.handleForBackend(),
        lowerBound.handleForBackend(),
        upperBound.handleForBackend(),
      ),
    );
  }

  max(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matMaxU8(left.handleForBackend(), right.handleForBackend()));
  }

  min(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matMinU8(left.handleForBackend(), right.handleForBackend()));
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

  repeat(source: Mat, rowRepeats: number, columnRepeats: number): Mat {
    validateDimension(rowRepeats, "rowRepeats");
    validateDimension(columnRepeats, "columnRepeats");
    return new Mat(this.#backend.matRepeat(source.handleForBackend(), rowRepeats, columnRepeats));
  }

  threshold(image: RgbaImage, threshold: number): RgbaImage {
    validateRgbaImage(image);
    validateThreshold(threshold);
    const data = this.#backend.thresholdRgba(image.data, image.width, image.height, threshold);
    return createRgbaImage(image.width, image.height, data);
  }

  subtract(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matSubtractU8(left.handleForBackend(), right.handleForBackend()));
  }

  transpose(source: Mat): Mat {
    return new Mat(this.#backend.matTranspose(source.handleForBackend()));
  }

  zerosF32(rows: number, columns: number, channels: number): Mat {
    validateZeroAllocation(rows, columns, channels, Float32Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matZerosF32(rows, columns, channels));
  }

  zerosF64(rows: number, columns: number, channels: number): Mat {
    validateZeroAllocation(rows, columns, channels, Float64Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matZerosF64(rows, columns, channels));
  }

  zerosI16(rows: number, columns: number, channels: number): Mat {
    validateZeroAllocation(rows, columns, channels, Int16Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matZerosI16(rows, columns, channels));
  }

  zerosI32(rows: number, columns: number, channels: number): Mat {
    validateZeroAllocation(rows, columns, channels, Int32Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matZerosI32(rows, columns, channels));
  }

  zerosI8(rows: number, columns: number, channels: number): Mat {
    validateZeroAllocation(rows, columns, channels, Int8Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matZerosI8(rows, columns, channels));
  }

  zerosU16(rows: number, columns: number, channels: number): Mat {
    validateZeroAllocation(rows, columns, channels, Uint16Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matZerosU16(rows, columns, channels));
  }

  zerosU8(rows: number, columns: number, channels: number): Mat {
    validateMatrixDimension(rows, "rows");
    validateMatrixDimension(columns, "columns");
    validateMatrixInput(rows, columns, channels, rows * columns * channels);
    return new Mat(this.#backend.matZerosU8(rows, columns, channels));
  }
}

function validateZeroAllocation(
  rows: number,
  columns: number,
  channels: number,
  byteWidth: number,
): void {
  validateMatrixInput(rows, columns, channels, rows * columns * channels * byteWidth, byteWidth);
}

/** Creates a client from a compatible backend. Most callers should use `initOpenCv`. */
export function createOpenCv(backend: OpenCvBackend): OpenCv {
  return new WasmOpenCv(backend);
}
