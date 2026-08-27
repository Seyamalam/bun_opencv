import { BindingError, OpenCvInputError } from "./error.js";

interface EmbindObjectInput {
  toString(): string;
}

type EmbindScalarInput = boolean | number | EmbindObjectInput | string | null | undefined;

/** Optional configuration accepted by `OpenCv.createMSER`. */
export interface MSEROptions {
  readonly delta?: number;
  readonly maxArea?: number;
  readonly minArea?: number;
  readonly pass2Only?: boolean;
}

/** OpenCV 4.13 defaults exposed by the MSER configuration methods. */
export const MSER_DEFAULTS = Object.freeze({
  delta: 5,
  maxArea: 14_400,
  minArea: 60,
  pass2Only: false,
});

/** Low-level MSER configuration object returned by the generated WebAssembly module. */
export interface WasmMSERHandle {
  free(): void;
  getDefaultName(): string;
  getDelta(): number;
  getMaxArea(): number;
  getMinArea(): number;
  getPass2Only(): boolean;
  setDelta(value: number): void;
  setMaxArea(value: number): void;
  setMinArea(value: number): void;
  setPass2Only(value: boolean): void;
}

/** Internal constructor contract exposed by wasm-bindgen's MSER configuration class. */
export interface WasmMSERFactory {
  create(
    delta?: number | null,
    minArea?: number | null,
    maxArea?: number | null,
    pass2Only?: boolean | null,
  ): WasmMSERHandle;
}

/** Rust-owned MSER configuration with an explicit lifetime. */
export class MSER {
  #handle: WasmMSERHandle | undefined;

  /** Low-level adapters may construct a detector from a compatible WASM handle. */
  constructor(handle: WasmMSERHandle) {
    this.#handle = handle;
  }

  getDefaultName(): string {
    requireExactArity(arguments.length, 0, "MSER.getDefaultName");
    return this.#owned().getDefaultName();
  }

  getDelta(): number {
    requireExactArity(arguments.length, 0, "MSER.getDelta");
    return this.#ownedConst().getDelta();
  }

  getMaxArea(): number {
    requireExactArity(arguments.length, 0, "MSER.getMaxArea");
    return this.#ownedConst().getMaxArea();
  }

  getMinArea(): number {
    requireExactArity(arguments.length, 0, "MSER.getMinArea");
    return this.#ownedConst().getMinArea();
  }

  getPass2Only(): boolean {
    requireExactArity(arguments.length, 0, "MSER.getPass2Only");
    return this.#ownedConst().getPass2Only();
  }

  setDelta(value: number): void {
    requireExactArity(arguments.length, 1, "MSER.setDelta");
    this.#owned().setDelta(toWasmI32(value));
  }

  setMaxArea(value: number): void {
    requireExactArity(arguments.length, 1, "MSER.setMaxArea");
    this.#owned().setMaxArea(toWasmI32(value));
  }

  setMinArea(value: number): void {
    requireExactArity(arguments.length, 1, "MSER.setMinArea");
    this.#owned().setMinArea(toWasmI32(value));
  }

  setPass2Only(value: boolean): void {
    requireExactArity(arguments.length, 1, "MSER.setPass2Only");
    this.#owned().setPass2Only(toWasmBoolean(value));
  }

  /** Releases the WASM handle with OpenCV.js-compatible repeated-delete behavior. */
  delete(): void {
    if (this.#handle === undefined) {
      throw new BindingError("MSER instance already deleted");
    }
    this.dispose();
  }

  /** Releases the WASM handle. Repeated calls do nothing. */
  dispose(): void {
    const handle = this.#handle;
    if (handle === undefined) return;
    this.#handle = undefined;
    handle.free();
  }

  #owned(): WasmMSERHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new BindingError("Cannot pass deleted object as a pointer of type MSER");
    }
    return handle;
  }

  #ownedConst(): WasmMSERHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new BindingError("Cannot pass deleted object as a pointer of type MSER const*");
    }
    return handle;
  }
}

export function validateMSEROptions(options: MSEROptions): void {
  if (options.delta !== undefined) validateSignedI32(options.delta, "MSER delta");
  if (options.minArea !== undefined) validateSignedI32(options.minArea, "MSER minimum area");
  if (options.maxArea !== undefined) validateSignedI32(options.maxArea, "MSER maximum area");
}

function validateSignedI32(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < -2_147_483_648 || value > 2_147_483_647) {
    throw new OpenCvInputError(`${name} must be a signed 32-bit integer`);
  }
}

function toWasmI32(value: EmbindScalarInput): number {
  if (value === true) return 1;
  if (value === false) return 0;
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- JS-to-Embind scalar boundary.
  if (typeof value !== "number") {
    throw new TypeError(`Cannot convert "${String(value)}" to int`);
  }
  if (value < -2_147_483_648 || value > 2_147_483_647) {
    throw new TypeError(
      `Passing a number "${String(value)}" from JS side to C/C++ side to an argument of type "int", which is outside the valid range [-2147483648, 2147483647]!`,
    );
  }
  return value | 0;
}

function toWasmBoolean(value: EmbindScalarInput): boolean {
  return Boolean(value);
}

function requireExactArity(actual: number, expected: number, method: string): void {
  if (actual !== expected) {
    throw new BindingError(
      `function ${method} called with ${actual} arguments, expected ${expected} args!`,
    );
  }
}
