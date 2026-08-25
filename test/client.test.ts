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
});
