import {
  createRgbaImage,
  validateDimension,
  validateRgbaImage,
  validateThreshold,
} from "./image.js";
import { OpenCvInputError } from "./error.js";
import { Mat, validateMatrixDimension, validateMatrixInput } from "./mat.js";
import type { MinMaxLocation, OpenCv, OpenCvBackend, RgbaImage, Scalar } from "./types.js";

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
    return this.#backend.matCountNonZero(source.handleForBackend());
  }

  extractChannel(source: Mat, channel: number): Mat {
    validateChannelIndex(channel);
    return new Mat(this.#backend.matExtractChannel(source.handleForBackend(), channel));
  }

  flip(source: Mat, flipCode: -1 | 0 | 1): Mat;
  flip(source: Mat, destination: Mat, flipCode: -1 | 0 | 1): void;
  flip(source: Mat, destinationOrCode: Mat | -1 | 0 | 1, flipCode?: -1 | 0 | 1): Mat | void {
    if (destinationOrCode instanceof Mat) {
      this.#backend.matFlipInto(
        source.handleForBackend(),
        destinationOrCode.handleForBackend(),
        requiredCode(flipCode),
      );
      return;
    }
    return new Mat(this.#backend.matFlip(source.handleForBackend(), destinationOrCode));
  }

  rotate(source: Mat, rotateCode: 0 | 1 | 2): Mat;
  rotate(source: Mat, destination: Mat, rotateCode: 0 | 1 | 2): void;
  rotate(source: Mat, destinationOrCode: Mat | 0 | 1 | 2, rotateCode?: 0 | 1 | 2): Mat | void {
    if (destinationOrCode instanceof Mat) {
      this.#backend.matRotateInto(
        source.handleForBackend(),
        destinationOrCode.handleForBackend(),
        requiredCode(rotateCode),
      );
      return;
    }
    return new Mat(this.#backend.matRotate(source.handleForBackend(), destinationOrCode));
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

  insertChannel(source: Mat, destination: Mat, channel: number): void {
    validateChannelIndex(channel);
    this.#backend.matInsertChannel(
      source.handleForBackend(),
      destination.handleForBackend(),
      channel,
    );
  }

  max(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matMaxU8(left.handleForBackend(), right.handleForBackend()));
  }

  mean(source: Mat): Scalar {
    return scalarFromArray(this.#backend.matMean(source.handleForBackend()));
  }

  merge(
    sources: readonly [Mat, Mat] | readonly [Mat, Mat, Mat] | readonly [Mat, Mat, Mat, Mat],
  ): Mat {
    const handles = sources.map((source) => source.handleForBackend());
    const first = handles[0];
    const second = handles[1];
    if (first === undefined || second === undefined) {
      throw new OpenCvInputError("merge requires two through four matrices");
    }
    if (handles.length === 2) {
      return new Mat(this.#backend.matMerge(first, second));
    }
    const third = handles[2];
    if (third === undefined) {
      throw new OpenCvInputError("merge requires a third matrix");
    }
    if (handles.length === 3) {
      return new Mat(this.#backend.matMerge3(first, second, third));
    }
    const fourth = handles[3];
    if (fourth === undefined) {
      throw new OpenCvInputError("merge requires a fourth matrix");
    }
    return new Mat(this.#backend.matMerge4(first, second, third, fourth));
  }

  min(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matMinU8(left.handleForBackend(), right.handleForBackend()));
  }

  minMaxLoc(source: Mat): MinMaxLocation {
    return minMaxLocationFromArray(this.#backend.matMinMaxLoc(source.handleForBackend()));
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

  repeat(source: Mat, rowRepeats: number, columnRepeats: number): Mat;
  repeat(source: Mat, rowRepeats: number, columnRepeats: number, destination: Mat): void;
  repeat(source: Mat, rowRepeats: number, columnRepeats: number, destination?: Mat): Mat | void {
    validateDimension(rowRepeats, "rowRepeats");
    validateDimension(columnRepeats, "columnRepeats");
    if (destination !== undefined) {
      this.#backend.matRepeatInto(
        source.handleForBackend(),
        destination.handleForBackend(),
        rowRepeats,
        columnRepeats,
      );
      return;
    }
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

  split(source: Mat): Mat[] {
    return this.#backend.matSplit(source.handleForBackend()).map((handle) => new Mat(handle));
  }

  sum(source: Mat): Scalar {
    return scalarFromArray(this.#backend.matSum(source.handleForBackend()));
  }

  transpose(source: Mat): Mat;
  transpose(source: Mat, destination: Mat): void;
  transpose(source: Mat, destination?: Mat): Mat | void {
    if (destination !== undefined) {
      this.#backend.matTransposeInto(source.handleForBackend(), destination.handleForBackend());
      return;
    }
    return new Mat(this.#backend.matTranspose(source.handleForBackend()));
  }

  trace(source: Mat): number {
    return this.#backend.matTrace(source.handleForBackend());
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

function scalarFromArray(values: Float64Array): Scalar {
  if (values.length !== 4) {
    throw new OpenCvInputError(`WASM scalar has ${values.length} lanes; expected 4`);
  }
  const lane0 = values[0];
  const lane1 = values[1];
  const lane2 = values[2];
  const lane3 = values[3];
  if (lane0 === undefined || lane1 === undefined || lane2 === undefined || lane3 === undefined) {
    throw new OpenCvInputError("WASM scalar is missing a lane");
  }
  return [lane0, lane1, lane2, lane3];
}

function minMaxLocationFromArray(values: Float64Array): MinMaxLocation {
  if (values.length !== 6) {
    throw new OpenCvInputError(`WASM minMaxLoc result has ${values.length} lanes; expected 6`);
  }
  const minVal = requiredFloat(values, 0);
  const maxVal = requiredFloat(values, 1);
  const minX = requiredFloat(values, 2);
  const minY = requiredFloat(values, 3);
  const maxX = requiredFloat(values, 4);
  const maxY = requiredFloat(values, 5);
  return {
    maxLoc: { x: maxX, y: maxY },
    maxVal,
    minLoc: { x: minX, y: minY },
    minVal,
  };
}

function requiredFloat(values: Float64Array, index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new OpenCvInputError(`WASM result is missing lane ${index}`);
  }
  return value;
}

function requiredCode<T extends number>(value: T | undefined): T {
  if (value === undefined) {
    throw new OpenCvInputError("operation code is required when a destination is supplied");
  }
  return value;
}

function validateChannelIndex(channel: number): void {
  if (!Number.isSafeInteger(channel) || channel < 0 || channel > 511) {
    throw new OpenCvInputError("channel must be a non-negative integer below 512");
  }
}

/** Creates a client from a compatible backend. Most callers should use `initOpenCv`. */
export function createOpenCv(backend: OpenCvBackend): OpenCv {
  return new WasmOpenCv(backend);
}
