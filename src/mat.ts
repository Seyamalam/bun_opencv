import { OpenCvInputError } from "./error.js";

const MAX_WASM_BYTE_LENGTH = 4_294_967_295;
const MAX_CHANNELS = 512;

/** Low-level matrix object returned by the generated WebAssembly module. */
export interface WasmMatHandle {
  readonly byteLength: number;
  readonly channels: number;
  readonly columns: number;
  readonly depth: number;
  readonly isContinuous: boolean;
  readonly rows: number;
  readonly rowStride: number;
  copyFromBytes(data: Uint8Array): void;
  free(): void;
  roi(row: number, column: number, rows: number, columns: number): WasmMatHandle;
  toFloat32Array(): Float32Array;
  toFloat64Array(): Float64Array;
  toInt16Array(): Int16Array;
  toInt32Array(): Int32Array;
  toInt8Array(): Int8Array;
  toUint16Array(): Uint16Array;
  toUint8Array(): Uint8Array;
}

/** Scalar element depth stored by a matrix. */
export type MatDepth = "u8" | "i8" | "u16" | "i16" | "i32" | "f32" | "f64";

/** Rust-owned matrix with explicit lifetime and zero-copy regions of interest. */
export class Mat {
  #handle: WasmMatHandle | undefined;

  /** Low-level adapters may construct a matrix from a compatible WASM handle. */
  constructor(handle: WasmMatHandle) {
    this.#handle = handle;
  }

  get byteLength(): number {
    return this.#owned().byteLength;
  }

  get channels(): number {
    return this.#owned().channels;
  }

  get columns(): number {
    return this.#owned().columns;
  }

  get depth(): MatDepth {
    return depthName(this.#owned().depth);
  }

  get isContinuous(): boolean {
    return this.#owned().isContinuous;
  }

  get rows(): number {
    return this.#owned().rows;
  }

  get rowStride(): number {
    return this.#owned().rowStride;
  }

  /** Returns a matrix that shares Rust storage with this matrix. */
  roi(row: number, column: number, rows: number, columns: number): Mat {
    validateIndex(row, "row");
    validateIndex(column, "column");
    validateMatrixDimension(rows, "rows");
    validateMatrixDimension(columns, "columns");
    return new Mat(this.#owned().roi(row, column, rows, columns));
  }

  /** Replaces the matrix's logical bytes, including a strided region of interest. */
  copyFromBytes(data: Uint8Array): void {
    if (data.byteLength !== this.byteLength) {
      throw new OpenCvInputError(
        `matrix buffer has ${data.byteLength} bytes; expected ${this.byteLength} bytes`,
      );
    }
    this.#owned().copyFromBytes(data);
  }

  /** Copies logical matrix bytes into JavaScript memory. */
  toUint8Array(): Uint8Array {
    return this.#owned().toUint8Array();
  }

  /** Copies signed 8-bit elements into JavaScript memory. */
  toInt8Array(): Int8Array {
    return this.#owned().toInt8Array();
  }

  /** Copies unsigned 16-bit elements into JavaScript memory. */
  toUint16Array(): Uint16Array {
    return this.#owned().toUint16Array();
  }

  /** Copies signed 16-bit elements into JavaScript memory. */
  toInt16Array(): Int16Array {
    return this.#owned().toInt16Array();
  }

  /** Copies signed 32-bit elements into JavaScript memory. */
  toInt32Array(): Int32Array {
    return this.#owned().toInt32Array();
  }

  /** Copies 32-bit floating-point elements into JavaScript memory. */
  toFloat32Array(): Float32Array {
    return this.#owned().toFloat32Array();
  }

  /** Copies 64-bit floating-point elements into JavaScript memory. */
  toFloat64Array(): Float64Array {
    return this.#owned().toFloat64Array();
  }

  /** @internal Returns the live WASM handle for package adapters. */
  handleForBackend(): WasmMatHandle {
    return this.#owned();
  }

  /** Releases this WASM handle. Shared regions remain valid until separately disposed. */
  dispose(): void {
    const handle = this.#handle;
    if (handle === undefined) {
      return;
    }
    this.#handle = undefined;
    handle.free();
  }

  #owned(): WasmMatHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new OpenCvInputError("matrix has been disposed");
    }
    return handle;
  }
}

export function validateMatrixInput(
  rows: number,
  columns: number,
  channels: number,
  byteLength: number,
  byteWidth = 1,
): void {
  validateMatrixDimension(rows, "rows");
  validateMatrixDimension(columns, "columns");
  if (!Number.isSafeInteger(channels) || channels <= 0 || channels > MAX_CHANNELS) {
    throw new OpenCvInputError(`channels must be an integer from 1 through ${MAX_CHANNELS}`);
  }

  if (!Number.isSafeInteger(byteWidth) || byteWidth <= 0) {
    throw new OpenCvInputError("matrix element byte width must be a positive integer");
  }

  const expected = rows * columns * channels * byteWidth;
  if (!Number.isSafeInteger(expected) || expected > MAX_WASM_BYTE_LENGTH) {
    throw new OpenCvInputError("matrix dimensions exceed the WASM buffer limit");
  }
  if (byteLength !== expected) {
    throw new OpenCvInputError(`matrix buffer has ${byteLength} bytes; expected ${expected} bytes`);
  }
}

function depthName(depth: number): MatDepth {
  switch (depth) {
    case 0:
      return "u8";
    case 1:
      return "i8";
    case 2:
      return "u16";
    case 3:
      return "i16";
    case 4:
      return "i32";
    case 5:
      return "f32";
    case 6:
      return "f64";
    default:
      throw new OpenCvInputError(`unsupported matrix depth code ${depth}`);
  }
}

export function validateMatrixDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_WASM_BYTE_LENGTH) {
    throw new OpenCvInputError(`${label} must be a positive 32-bit integer`);
  }
}

function validateIndex(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_WASM_BYTE_LENGTH) {
    throw new OpenCvInputError(`${label} must be a non-negative 32-bit integer`);
  }
}
