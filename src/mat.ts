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
  free(): void;
  roi(row: number, column: number, rows: number, columns: number): WasmMatHandle;
  toUint8Array(): Uint8Array;
}

/** Element depth implemented by the current matrix storage. */
export type MatDepth = "u8";

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
    const depth = this.#owned().depth;
    if (depth !== 0) {
      throw new OpenCvInputError(`unsupported matrix depth code ${depth}`);
    }
    return "u8";
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

  /** Copies logical matrix bytes into JavaScript memory. */
  toUint8Array(): Uint8Array {
    return this.#owned().toUint8Array();
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
): void {
  validateMatrixDimension(rows, "rows");
  validateMatrixDimension(columns, "columns");
  if (!Number.isSafeInteger(channels) || channels <= 0 || channels > MAX_CHANNELS) {
    throw new OpenCvInputError(`channels must be an integer from 1 through ${MAX_CHANNELS}`);
  }

  const expected = rows * columns * channels;
  if (!Number.isSafeInteger(expected) || expected > MAX_WASM_BYTE_LENGTH) {
    throw new OpenCvInputError("matrix dimensions exceed the WASM buffer limit");
  }
  if (byteLength !== expected) {
    throw new OpenCvInputError(`matrix buffer has ${byteLength} bytes; expected ${expected} bytes`);
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
