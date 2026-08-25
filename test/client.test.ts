import { describe, expect, test } from "bun:test";

import { createOpenCv, createRgbaImage, OpenCvInputError } from "../src/index.js";
import type { OpenCvBackend, WasmMatHandle } from "../src/index.js";

class CopyingMatHandle implements WasmMatHandle {
  readonly byteLength: number;
  readonly depth = 0;
  readonly isContinuous = true;
  readonly rowStride: number;

  constructor(
    readonly rows: number,
    readonly columns: number,
    readonly channels: number,
    readonly data: Uint8Array,
  ) {
    this.byteLength = rows * columns * channels;
    this.rowStride = columns * channels;
  }

  free(): void {}

  roi(row: number, column: number, rows: number, columns: number): WasmMatHandle {
    const output = new Uint8Array(rows * columns * this.channels);
    for (let targetRow = 0; targetRow < rows; targetRow += 1) {
      const sourceStart = (row + targetRow) * this.rowStride + column * this.channels;
      const sourceEnd = sourceStart + columns * this.channels;
      const targetStart = targetRow * columns * this.channels;
      output.set(this.data.subarray(sourceStart, sourceEnd), targetStart);
    }
    return new CopyingMatHandle(rows, columns, this.channels, output);
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.data);
  }
}

class CopyingBackend implements OpenCvBackend {
  grayscaleRgba(data: Uint8Array): Uint8Array {
    return new Uint8Array(data);
  }

  invertRgba(data: Uint8Array): Uint8Array {
    return new Uint8Array(data);
  }

  matFromU8(data: Uint8Array, rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, new Uint8Array(data));
  }

  matZerosU8(rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, new Uint8Array(rows * columns * channels));
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
});
