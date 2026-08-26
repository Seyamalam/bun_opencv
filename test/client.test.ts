import { describe, expect, test } from "bun:test";

import { createOpenCv, createRgbaImage, OpenCvInputError } from "../src/index.js";
import type { OpenCvBackend, WasmMatHandle } from "../src/index.js";

class CopyingMatHandle implements WasmMatHandle {
  readonly byteLength: number;
  readonly isContinuous = true;
  readonly rowStride: number;

  constructor(
    readonly rows: number,
    readonly columns: number,
    readonly channels: number,
    readonly data: Uint8Array,
    readonly depth = 0,
  ) {
    const byteWidth = depthByteWidth(depth);
    this.byteLength = rows * columns * channels * byteWidth;
    this.rowStride = columns * channels * byteWidth;
  }

  free(): void {}

  copyFromBytes(data: Uint8Array): void {
    if (data.byteLength !== this.byteLength) {
      throw new OpenCvInputError("matrix buffer length mismatch");
    }
    this.data.set(data);
  }

  roi(row: number, column: number, rows: number, columns: number): WasmMatHandle {
    const byteWidth = depthByteWidth(this.depth);
    const output = new Uint8Array(rows * columns * this.channels * byteWidth);
    for (let targetRow = 0; targetRow < rows; targetRow += 1) {
      const sourceStart = (row + targetRow) * this.rowStride + column * this.channels * byteWidth;
      const sourceEnd = sourceStart + columns * this.channels * byteWidth;
      const targetStart = targetRow * columns * this.channels * byteWidth;
      output.set(this.data.subarray(sourceStart, sourceEnd), targetStart);
    }
    return new CopyingMatHandle(rows, columns, this.channels, output, this.depth);
  }

  toFloat32Array(): Float32Array {
    return new Float32Array(this.data.slice().buffer);
  }

  toFloat64Array(): Float64Array {
    return new Float64Array(this.data.slice().buffer);
  }

  toInt16Array(): Int16Array {
    return new Int16Array(this.data.slice().buffer);
  }

  toInt32Array(): Int32Array {
    return new Int32Array(this.data.slice().buffer);
  }

  toInt8Array(): Int8Array {
    return new Int8Array(this.data.slice().buffer);
  }

  toUint16Array(): Uint16Array {
    return new Uint16Array(this.data.slice().buffer);
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.data);
  }
}

function depthByteWidth(depth: number): number {
  if (depth === 0 || depth === 1) {
    return 1;
  }
  if (depth === 2 || depth === 3) {
    return 2;
  }
  if (depth === 4 || depth === 5) {
    return 4;
  }
  return 8;
}

function copyViewBytes(data: ArrayBufferView): Uint8Array {
  return new Uint8Array(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}

function mergeHandles(sources: readonly WasmMatHandle[]): WasmMatHandle {
  const first = sources[0];
  if (first === undefined) {
    throw new OpenCvInputError("merge requires a source");
  }
  const scalarWidth = depthByteWidth(first.depth);
  const channels = sources.reduce((total, source) => total + source.channels, 0);
  const output = new Uint8Array(first.rows * first.columns * channels * scalarWidth);
  for (let pixel = 0; pixel < first.rows * first.columns; pixel += 1) {
    let targetChannel = 0;
    for (const source of sources) {
      const bytes = source.toUint8Array();
      const sourceStart = pixel * source.channels * scalarWidth;
      const targetStart = (pixel * channels + targetChannel) * scalarWidth;
      output.set(
        bytes.subarray(sourceStart, sourceStart + source.channels * scalarWidth),
        targetStart,
      );
      targetChannel += source.channels;
    }
  }
  return new CopyingMatHandle(first.rows, first.columns, channels, output, first.depth);
}

class CopyingBackend implements OpenCvBackend {
  grayscaleRgba(data: Uint8Array): Uint8Array {
    return new Uint8Array(data);
  }

  invertRgba(data: Uint8Array): Uint8Array {
    return new Uint8Array(data);
  }

  matFromF32(data: Float32Array, rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, copyViewBytes(data), 5);
  }

  matFromF64(data: Float64Array, rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, copyViewBytes(data), 6);
  }

  matFromI16(data: Int16Array, rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, copyViewBytes(data), 3);
  }

  matFromI32(data: Int32Array, rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, copyViewBytes(data), 4);
  }

  matFromI8(data: Int8Array, rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, copyViewBytes(data), 1);
  }

  matFromU16(data: Uint16Array, rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, copyViewBytes(data), 2);
  }

  matFromU8(data: Uint8Array, rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, new Uint8Array(data));
  }

  matFlip(source: WasmMatHandle, flipCode: number): WasmMatHandle {
    const input = source.toUint8Array();
    const output = new Uint8Array(input.byteLength);
    const pixelBytes = source.channels * depthByteWidth(source.depth);
    for (let row = 0; row < source.rows; row += 1) {
      for (let column = 0; column < source.columns; column += 1) {
        const sourceRow = flipCode === 0 || flipCode === -1 ? source.rows - row - 1 : row;
        const sourceColumn =
          flipCode === 1 || flipCode === -1 ? source.columns - column - 1 : column;
        const sourceOffset = (sourceRow * source.columns + sourceColumn) * pixelBytes;
        const outputOffset = (row * source.columns + column) * pixelBytes;
        output.set(input.subarray(sourceOffset, sourceOffset + pixelBytes), outputOffset);
      }
    }
    return new CopyingMatHandle(source.rows, source.columns, source.channels, output, source.depth);
  }

  matFlipInto(source: WasmMatHandle, destination: WasmMatHandle, flipCode: number): void {
    destination.copyFromBytes(this.matFlip(source, flipCode).toUint8Array());
  }

  matSplit(source: WasmMatHandle): WasmMatHandle[] {
    const scalarWidth = depthByteWidth(source.depth);
    const input = source.toUint8Array();
    return Array.from({ length: source.channels }, (_, channel) => {
      const output = new Uint8Array(source.rows * source.columns * scalarWidth);
      for (let pixel = 0; pixel < source.rows * source.columns; pixel += 1) {
        const inputOffset = (pixel * source.channels + channel) * scalarWidth;
        output.set(input.subarray(inputOffset, inputOffset + scalarWidth), pixel * scalarWidth);
      }
      return new CopyingMatHandle(source.rows, source.columns, 1, output, source.depth);
    });
  }

  matMerge(first: WasmMatHandle, second: WasmMatHandle): WasmMatHandle {
    return mergeHandles([first, second]);
  }

  matMerge3(first: WasmMatHandle, second: WasmMatHandle, third: WasmMatHandle): WasmMatHandle {
    return mergeHandles([first, second, third]);
  }

  matMerge4(
    first: WasmMatHandle,
    second: WasmMatHandle,
    third: WasmMatHandle,
    fourth: WasmMatHandle,
  ): WasmMatHandle {
    return mergeHandles([first, second, third, fourth]);
  }

  matExtractChannel(source: WasmMatHandle, channel: number): WasmMatHandle {
    const output = this.matSplit(source)[channel];
    if (output === undefined) {
      throw new OpenCvInputError("channel is out of bounds");
    }
    return output;
  }

  matInsertChannel(source: WasmMatHandle, destination: WasmMatHandle, channel: number): void {
    const scalarWidth = depthByteWidth(destination.depth);
    const input = source.toUint8Array();
    const output = destination.toUint8Array();
    for (let pixel = 0; pixel < destination.rows * destination.columns; pixel += 1) {
      const sourceOffset = pixel * scalarWidth;
      const destinationOffset = (pixel * destination.channels + channel) * scalarWidth;
      output.set(input.subarray(sourceOffset, sourceOffset + scalarWidth), destinationOffset);
    }
    destination.copyFromBytes(output);
  }

  matAbsdiffU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, (leftValue, rightValue) => Math.abs(leftValue - rightValue));
  }

  matAddU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, (leftValue, rightValue) => Math.min(leftValue + rightValue, 255));
  }

  matBitwiseAndU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, (leftValue, rightValue) => leftValue & rightValue);
  }

  matBitwiseNotU8(source: WasmMatHandle): WasmMatHandle {
    return unaryU8(source, (value) => ~value & 255);
  }

  matBitwiseOrU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, (leftValue, rightValue) => leftValue | rightValue);
  }

  matBitwiseXorU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, (leftValue, rightValue) => leftValue ^ rightValue);
  }

  matCompareEqU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, (leftValue, rightValue) => (leftValue === rightValue ? 255 : 0));
  }

  matCountNonZero(source: WasmMatHandle): number {
    return source.toUint8Array().reduce((count, value) => count + Number(value !== 0), 0);
  }

  matInRangeU8(
    source: WasmMatHandle,
    lowerBound: WasmMatHandle,
    upperBound: WasmMatHandle,
  ): WasmMatHandle {
    const values = source.toUint8Array();
    const lower = lowerBound.toUint8Array();
    const upper = upperBound.toUint8Array();
    const output = new Uint8Array(source.rows * source.columns);
    for (let pixel = 0; pixel < output.length; pixel += 1) {
      let inside = true;
      for (let channel = 0; channel < source.channels; channel += 1) {
        const index = pixel * source.channels + channel;
        const value = byteAt(values, index);
        inside &&= value >= byteAt(lower, index) && value <= byteAt(upper, index);
      }
      output[pixel] = inside ? 255 : 0;
    }
    return new CopyingMatHandle(source.rows, source.columns, 1, output);
  }

  matMaxU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, Math.max);
  }

  matMean(source: WasmMatHandle): Float64Array {
    const totals = this.matSum(source);
    const output = new Float64Array(4);
    const pixels = source.rows * source.columns;
    for (let channel = 0; channel < source.channels; channel += 1) {
      output[channel] = floatAt(totals, channel) / pixels;
    }
    return output;
  }

  matMinU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, Math.min);
  }

  matMinMaxLoc(source: WasmMatHandle): Float64Array {
    const data = source.toUint8Array();
    let minimum = byteAt(data, 0);
    let maximum = minimum;
    let minimumIndex = 0;
    let maximumIndex = 0;
    for (let index = 1; index < data.length; index += 1) {
      const value = byteAt(data, index);
      if (value < minimum) {
        minimum = value;
        minimumIndex = index;
      }
      if (value > maximum) {
        maximum = value;
        maximumIndex = index;
      }
    }
    return new Float64Array([
      minimum,
      maximum,
      minimumIndex % source.columns,
      Math.floor(minimumIndex / source.columns),
      maximumIndex % source.columns,
      Math.floor(maximumIndex / source.columns),
    ]);
  }

  matSubtractU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, (leftValue, rightValue) => Math.max(leftValue - rightValue, 0));
  }

  matSum(source: WasmMatHandle): Float64Array {
    const output = new Float64Array(4);
    const data = source.toUint8Array();
    for (let index = 0; index < data.length; index += 1) {
      const channel = index % source.channels;
      output[channel] = floatAt(output, channel) + byteAt(data, index);
    }
    return output;
  }

  matTranspose(source: WasmMatHandle): WasmMatHandle {
    const input = source.toUint8Array();
    const output = new Uint8Array(input.byteLength);
    const pixelBytes = source.channels * depthByteWidth(source.depth);
    for (let row = 0; row < source.columns; row += 1) {
      for (let column = 0; column < source.rows; column += 1) {
        const sourceOffset = (column * source.columns + row) * pixelBytes;
        const outputOffset = (row * source.rows + column) * pixelBytes;
        output.set(input.subarray(sourceOffset, sourceOffset + pixelBytes), outputOffset);
      }
    }
    return new CopyingMatHandle(source.columns, source.rows, source.channels, output, source.depth);
  }

  matTransposeInto(source: WasmMatHandle, destination: WasmMatHandle): void {
    destination.copyFromBytes(this.matTranspose(source).toUint8Array());
  }

  matZerosU8(rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, new Uint8Array(rows * columns * channels));
  }

  matZerosF32(rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(
      rows,
      columns,
      channels,
      new Uint8Array(rows * columns * channels * Float32Array.BYTES_PER_ELEMENT),
      5,
    );
  }

  matTrace(source: WasmMatHandle): number {
    const data = source.toUint8Array();
    const diagonal = Math.min(source.rows, source.columns);
    let total = 0;
    for (let position = 0; position < diagonal; position += 1) {
      const index = (position * source.columns + position) * source.channels;
      total += byteAt(data, index);
    }
    return total;
  }

  matRotate(source: WasmMatHandle, rotateCode: number): WasmMatHandle {
    if (rotateCode === 1) {
      return this.matFlip(source, -1);
    }
    const transposed = this.matTranspose(source);
    return this.matFlip(transposed, rotateCode === 0 ? 1 : 0);
  }

  matRotateInto(source: WasmMatHandle, destination: WasmMatHandle, rotateCode: number): void {
    destination.copyFromBytes(this.matRotate(source, rotateCode).toUint8Array());
  }

  matRepeat(source: WasmMatHandle, rowRepeats: number, columnRepeats: number): WasmMatHandle {
    const input = source.toUint8Array();
    const rows = source.rows * rowRepeats;
    const columns = source.columns * columnRepeats;
    const pixelBytes = source.channels * depthByteWidth(source.depth);
    const output = new Uint8Array(rows * columns * pixelBytes);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const sourceOffset =
          ((row % source.rows) * source.columns + (column % source.columns)) * pixelBytes;
        const outputOffset = (row * columns + column) * pixelBytes;
        output.set(input.subarray(sourceOffset, sourceOffset + pixelBytes), outputOffset);
      }
    }
    return new CopyingMatHandle(rows, columns, source.channels, output, source.depth);
  }

  matRepeatInto(
    source: WasmMatHandle,
    destination: WasmMatHandle,
    rowRepeats: number,
    columnRepeats: number,
  ): void {
    destination.copyFromBytes(this.matRepeat(source, rowRepeats, columnRepeats).toUint8Array());
  }

  matZerosF64(rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(
      rows,
      columns,
      channels,
      new Uint8Array(rows * columns * channels * Float64Array.BYTES_PER_ELEMENT),
      6,
    );
  }

  matZerosI16(rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(
      rows,
      columns,
      channels,
      new Uint8Array(rows * columns * channels * Int16Array.BYTES_PER_ELEMENT),
      3,
    );
  }

  matZerosI32(rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(
      rows,
      columns,
      channels,
      new Uint8Array(rows * columns * channels * Int32Array.BYTES_PER_ELEMENT),
      4,
    );
  }

  matZerosI8(rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(
      rows,
      columns,
      channels,
      new Uint8Array(rows * columns * channels),
      1,
    );
  }

  matZerosU16(rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(
      rows,
      columns,
      channels,
      new Uint8Array(rows * columns * channels * Uint16Array.BYTES_PER_ELEMENT),
      2,
    );
  }

  resizeNearestRgba(
    _data: Uint8Array,
    _width: number,
    _height: number,
    targetWidth: number,
    targetHeight: number,
  ): Uint8Array {
    return new Uint8Array(targetWidth * targetHeight * 4);
  }

  thresholdRgba(data: Uint8Array): Uint8Array {
    return new Uint8Array(data);
  }
}

function binaryU8(
  left: WasmMatHandle,
  right: WasmMatHandle,
  operation: (leftValue: number, rightValue: number) => number,
): WasmMatHandle {
  const leftData = left.toUint8Array();
  const rightData = right.toUint8Array();
  const output = leftData.map((value, index) => operation(value, byteAt(rightData, index)));
  return new CopyingMatHandle(left.rows, left.columns, left.channels, output);
}

function byteAt(data: Uint8Array, index: number): number {
  const value = data[index];
  if (value === undefined) {
    throw new RangeError(`missing byte at index ${index}`);
  }
  return value;
}

function floatAt(data: Float64Array, index: number): number {
  const value = data[index];
  if (value === undefined) {
    throw new RangeError(`missing float at index ${index}`);
  }
  return value;
}

function unaryU8(source: WasmMatHandle, operation: (value: number) => number): WasmMatHandle {
  return new CopyingMatHandle(
    source.rows,
    source.columns,
    source.channels,
    source.toUint8Array().map(operation),
  );
}

describe("createRgbaImage", () => {
  test("copies caller-owned data", () => {
    const input = new Uint8Array([1, 2, 3, 4]);
    const image = createRgbaImage(1, 1, input);
    input[0] = 99;
    expect(image.data).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  test("rejects a mismatched RGBA buffer", () => {
    expect(() => createRgbaImage(2, 1, new Uint8Array(4))).toThrow(OpenCvInputError);
  });
});

describe("OpenCv client", () => {
  const client = createOpenCv(new CopyingBackend());
  const image = createRgbaImage(1, 1, new Uint8Array([1, 2, 3, 255]));

  test("returns validated output", () => {
    expect(client.grayscale(image)).toEqual(image);
    expect(client.invert(image)).toEqual(image);
    expect(client.threshold(image, 127)).toEqual(image);
  });

  test("validates threshold values before calling WASM", () => {
    expect(() => client.threshold(image, 256)).toThrow(OpenCvInputError);
    expect(() => client.threshold(image, 1.5)).toThrow(OpenCvInputError);
  });

  test("uses target dimensions for resized output", () => {
    const resized = client.resizeNearest(image, 2, 3);
    expect(resized.width).toBe(2);
    expect(resized.height).toBe(3);
    expect(resized.data.byteLength).toBe(24);
  });

  test("creates Rust-owned matrix handles and regions", () => {
    const matrix = client.matFromU8(2, 4, 1, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    const region = matrix.roi(0, 1, 2, 2);

    expect(matrix.depth).toBe("u8");
    expect(region.rows).toBe(2);
    expect(region.columns).toBe(2);
    expect(region.toUint8Array()).toEqual(new Uint8Array([2, 3, 6, 7]));

    matrix.dispose();
    expect(() => matrix.rows).toThrow(OpenCvInputError);
    expect(region.toUint8Array()).toEqual(new Uint8Array([2, 3, 6, 7]));
    region.dispose();
  });

  test("allocates zero-filled matrices", () => {
    const matrix = client.zerosU8(2, 3, 4);
    expect(matrix.byteLength).toBe(24);
    expect(matrix.toUint8Array()).toEqual(new Uint8Array(24));
    matrix.dispose();
  });

  test("exposes factories for every scalar matrix depth", () => {
    expect(client).toHaveProperty("matFromI8");
    expect(client).toHaveProperty("matFromU16");
    expect(client).toHaveProperty("matFromI16");
    expect(client).toHaveProperty("matFromI32");
    expect(client).toHaveProperty("matFromF32");
    expect(client).toHaveProperty("matFromF64");

    const signed = client.matFromI16(1, 3, 1, new Int16Array([-32_768, 7, 32_767]));
    expect(signed.depth).toBe("i16");
    expect(signed.toInt16Array()).toEqual(new Int16Array([-32_768, 7, 32_767]));
    signed.dispose();

    const floating = client.zerosF32(2, 2, 1);
    expect(floating.depth).toBe("f32");
    expect(floating.toFloat32Array()).toEqual(new Float32Array(4));
    floating.dispose();
  });

  test("exposes matrix-based core operations", () => {
    expect(client).toHaveProperty("add");
    expect(client).toHaveProperty("subtract");
    expect(client).toHaveProperty("absdiff");
    expect(client).toHaveProperty("bitwiseAnd");
    expect(client).toHaveProperty("bitwiseOr");
    expect(client).toHaveProperty("bitwiseXor");
    expect(client).toHaveProperty("bitwiseNot");
    expect(client).toHaveProperty("min");
    expect(client).toHaveProperty("max");
    expect(client).toHaveProperty("compareEqual");
    expect(client).toHaveProperty("inRange");
    expect(client).toHaveProperty("countNonZero");

    const left = client.matFromU8(1, 3, 1, new Uint8Array([250, 2, 3]));
    const right = client.matFromU8(1, 3, 1, new Uint8Array([10, 5, 3]));
    const added = client.add(left, right);
    const subtracted = client.subtract(left, right);
    const difference = client.absdiff(left, right);
    const equal = client.compareEqual(left, right);
    const inverted = client.bitwiseNot(left);

    expect(added.toUint8Array()).toEqual(new Uint8Array([255, 7, 6]));
    expect(subtracted.toUint8Array()).toEqual(new Uint8Array([240, 0, 0]));
    expect(difference.toUint8Array()).toEqual(new Uint8Array([240, 3, 0]));
    expect(equal.toUint8Array()).toEqual(new Uint8Array([0, 0, 255]));
    expect(inverted.toUint8Array()).toEqual(new Uint8Array([5, 253, 252]));
    expect(client.countNonZero(left)).toBe(3);

    for (const matrix of [added, subtracted, difference, equal, inverted, left, right]) {
      matrix.dispose();
    }
  });

  test("exposes matrix layout operations", () => {
    expect(client).toHaveProperty("flip");
    expect(client).toHaveProperty("transpose");
    expect(client).toHaveProperty("rotate");
    expect(client).toHaveProperty("repeat");

    const source = client.matFromU8(2, 3, 1, new Uint8Array([1, 2, 3, 4, 5, 6]));
    const horizontal = client.flip(source, 1);
    const transposed = client.transpose(source);
    const clockwise = client.rotate(source, 0);
    const repeated = client.repeat(source, 2, 1);
    const flippedDestination = client.zerosU8(2, 3, 1);
    const transposedDestination = client.zerosU8(3, 2, 1);
    const rotatedDestination = client.zerosU8(3, 2, 1);
    const repeatedDestination = client.zerosU8(4, 3, 1);
    client.flip(source, flippedDestination, 1);
    client.transpose(source, transposedDestination);
    client.rotate(source, rotatedDestination, 0);
    client.repeat(source, 2, 1, repeatedDestination);
    expect(horizontal.toUint8Array()).toEqual(new Uint8Array([3, 2, 1, 6, 5, 4]));
    expect(transposed.rows).toBe(3);
    expect(transposed.columns).toBe(2);
    expect(transposed.toUint8Array()).toEqual(new Uint8Array([1, 4, 2, 5, 3, 6]));
    expect(clockwise.rows).toBe(3);
    expect(clockwise.columns).toBe(2);
    expect(clockwise.toUint8Array()).toEqual(new Uint8Array([4, 1, 5, 2, 6, 3]));
    expect(repeated.rows).toBe(4);
    expect(repeated.toUint8Array()).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6]));
    expect(flippedDestination.toUint8Array()).toEqual(new Uint8Array([3, 2, 1, 6, 5, 4]));
    expect(transposedDestination.toUint8Array()).toEqual(new Uint8Array([1, 4, 2, 5, 3, 6]));
    expect(rotatedDestination.toUint8Array()).toEqual(new Uint8Array([4, 1, 5, 2, 6, 3]));
    expect(repeatedDestination.toUint8Array()).toEqual(
      new Uint8Array([1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6]),
    );
    repeatedDestination.dispose();
    rotatedDestination.dispose();
    transposedDestination.dispose();
    flippedDestination.dispose();
    repeated.dispose();
    clockwise.dispose();
    transposed.dispose();
    horizontal.dispose();
    source.dispose();
  });

  test("exposes typed matrix reductions", () => {
    expect(client).toHaveProperty("sum");
    expect(client).toHaveProperty("mean");
    expect(client).toHaveProperty("minMaxLoc");
    expect(client).toHaveProperty("trace");

    const source = client.matFromU8(1, 2, 3, new Uint8Array([1, 10, 100, 3, 30, 200]));
    expect(client.sum(source)).toEqual([4, 40, 300, 0]);
    expect(client.mean(source)).toEqual([2, 20, 150, 0]);
    source.dispose();

    const extremaSource = client.matFromU8(2, 3, 1, new Uint8Array([5, 2, 9, 2, 9, 4]));
    expect(client.minMaxLoc(extremaSource)).toEqual({
      maxLoc: { x: 2, y: 0 },
      maxVal: 9,
      minLoc: { x: 1, y: 0 },
      minVal: 2,
    });
    expect(client.trace(extremaSource)).toBe(14);
    extremaSource.dispose();
  });

  test("mutates shared matrix destinations", () => {
    const matrix = client.matFromU8(2, 3, 1, new Uint8Array([1, 2, 3, 4, 5, 6]));
    matrix.copyFromBytes(new Uint8Array([6, 5, 4, 3, 2, 1]));
    expect(matrix.toUint8Array()).toEqual(new Uint8Array([6, 5, 4, 3, 2, 1]));
    expect(() => matrix.copyFromBytes(new Uint8Array([1]))).toThrow(OpenCvInputError);
    matrix.dispose();
  });

  test("splits, merges, extracts, and inserts channels", () => {
    const source = client.matFromU8(1, 2, 3, new Uint8Array([1, 10, 100, 2, 20, 200]));
    const planes = client.split(source);
    expect(planes.map((plane) => plane.toUint8Array())).toEqual([
      new Uint8Array([1, 2]),
      new Uint8Array([10, 20]),
      new Uint8Array([100, 200]),
    ]);
    const merged = client.merge([planes[0]!, planes[1]!, planes[2]!]);
    expect(merged.toUint8Array()).toEqual(source.toUint8Array());
    const extracted = client.extractChannel(source, 1);
    expect(extracted.toUint8Array()).toEqual(new Uint8Array([10, 20]));
    const destination = client.zerosU8(1, 2, 3);
    client.insertChannel(extracted, destination, 2);
    expect(destination.toUint8Array()).toEqual(new Uint8Array([0, 0, 10, 0, 0, 20]));
    destination.dispose();
    extracted.dispose();
    merged.dispose();
    for (const plane of planes) plane.dispose();
    source.dispose();
  });
});
