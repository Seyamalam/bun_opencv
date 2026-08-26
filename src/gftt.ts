import { BindingError, OpenCvInputError } from "./error.js";

interface EmbindObjectInput {
  toString(): string;
}

type EmbindScalarInput = boolean | number | EmbindObjectInput | string | null | undefined;

/** Optional configuration accepted by `OpenCv.createGFTTDetector`. */
export interface GFTTDetectorOptions {
  readonly blockSize?: number;
  readonly k?: number;
  readonly maxFeatures?: number;
  readonly minDistance?: number;
  readonly qualityLevel?: number;
  readonly useHarrisDetector?: boolean;
}

/** OpenCV 4.13 defaults used when GFTT detector options are omitted. */
export const GFTT_DETECTOR_DEFAULTS: Readonly<Required<GFTTDetectorOptions>> = Object.freeze({
  blockSize: 3,
  k: 0.04,
  maxFeatures: 1_000,
  minDistance: 1,
  qualityLevel: 0.01,
  useHarrisDetector: false,
});

/** Low-level GFTT detector object returned by the generated WebAssembly module. */
export interface WasmGFTTDetectorHandle {
  free(): void;
  getBlockSize(): number;
  getDefaultName(): string;
  getHarrisDetector(): boolean;
  getK(): number;
  getMaxFeatures(): number;
  getMinDistance(): number;
  getQualityLevel(): number;
  setBlockSize(value: number): void;
  setHarrisDetector(value: boolean): void;
  setK(value: number): void;
  setMaxFeatures(value: number): void;
  setMinDistance(value: number): void;
  setQualityLevel(value: number): void;
}

/** Static constructor contract exposed by wasm-bindgen's `GFTTDetector` class. */
export interface WasmGFTTDetectorFactory {
  create(
    maxFeatures?: number | null,
    qualityLevel?: number | null,
    minDistance?: number | null,
    blockSize?: number | null,
    useHarrisDetector?: boolean | null,
    k?: number | null,
  ): WasmGFTTDetectorHandle;
}

/** Rust-owned GFTT detector configuration with an explicit lifetime. */
export class GFTTDetector {
  #handle: WasmGFTTDetectorHandle | undefined;

  /** Low-level adapters may construct a detector from a compatible WASM handle. */
  constructor(handle: WasmGFTTDetectorHandle) {
    this.#handle = handle;
  }

  getBlockSize(): number {
    requireExactArity(arguments.length, 0, "GFTTDetector.getBlockSize");
    return this.#ownedConst().getBlockSize();
  }

  getDefaultName(): string {
    requireExactArity(arguments.length, 0, "GFTTDetector.getDefaultName");
    return this.#owned().getDefaultName();
  }

  getHarrisDetector(): boolean {
    requireExactArity(arguments.length, 0, "GFTTDetector.getHarrisDetector");
    return this.#ownedConst().getHarrisDetector();
  }

  getK(): number {
    requireExactArity(arguments.length, 0, "GFTTDetector.getK");
    return this.#ownedConst().getK();
  }

  getMaxFeatures(): number {
    requireExactArity(arguments.length, 0, "GFTTDetector.getMaxFeatures");
    return this.#ownedConst().getMaxFeatures();
  }

  getMinDistance(): number {
    requireExactArity(arguments.length, 0, "GFTTDetector.getMinDistance");
    return this.#ownedConst().getMinDistance();
  }

  getQualityLevel(): number {
    requireExactArity(arguments.length, 0, "GFTTDetector.getQualityLevel");
    return this.#ownedConst().getQualityLevel();
  }

  setBlockSize(value: number): void {
    requireExactArity(arguments.length, 1, "GFTTDetector.setBlockSize");
    this.#owned().setBlockSize(toWasmI32(value));
  }

  setHarrisDetector(value: boolean): void {
    requireExactArity(arguments.length, 1, "GFTTDetector.setHarrisDetector");
    this.#owned().setHarrisDetector(toWasmBoolean(value));
  }

  setK(value: number): void {
    requireExactArity(arguments.length, 1, "GFTTDetector.setK");
    this.#owned().setK(toWasmF64(value));
  }

  setMaxFeatures(value: number): void {
    requireExactArity(arguments.length, 1, "GFTTDetector.setMaxFeatures");
    this.#owned().setMaxFeatures(toWasmI32(value));
  }

  setMinDistance(value: number): void {
    requireExactArity(arguments.length, 1, "GFTTDetector.setMinDistance");
    this.#owned().setMinDistance(toWasmF64(value));
  }

  setQualityLevel(value: number): void {
    requireExactArity(arguments.length, 1, "GFTTDetector.setQualityLevel");
    this.#owned().setQualityLevel(toWasmF64(value));
  }

  /** Releases the WASM handle with OpenCV.js-compatible repeated-delete behavior. */
  delete(): void {
    if (this.#handle === undefined) {
      throw new BindingError("GFTTDetector instance already deleted");
    }
    this.dispose();
  }

  /** Releases the WASM handle. Repeated calls do nothing. */
  dispose(): void {
    const handle = this.#handle;
    if (handle === undefined) {
      return;
    }
    this.#handle = undefined;
    handle.free();
  }

  #owned(): WasmGFTTDetectorHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new BindingError("Cannot pass deleted object as a pointer of type GFTTDetector");
    }
    return handle;
  }

  #ownedConst(): WasmGFTTDetectorHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new BindingError("Cannot pass deleted object as a pointer of type GFTTDetector const*");
    }
    return handle;
  }
}

export function validateGFTTDetectorOptions(options: GFTTDetectorOptions): void {
  if (options.maxFeatures !== undefined) {
    validateSignedI32(options.maxFeatures, "GFTT maximum feature count");
  }
  if (options.blockSize !== undefined) {
    validateSignedI32(options.blockSize, "GFTT block size");
  }
}

function validateSignedI32(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < -2_147_483_648 || value > 2_147_483_647) {
    throw new OpenCvInputError(`${name} must be a signed 32-bit integer`);
  }
}

function toWasmI32(value: EmbindScalarInput): number {
  if (value === true) {
    return 1;
  }
  if (value === false) {
    return 0;
  }
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- This is the JS-to-Embind scalar parser boundary.
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

function toWasmF64(value: EmbindScalarInput): number {
  if (value === true) {
    return 1;
  }
  if (value === false) {
    return 0;
  }
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- This is the JS-to-Embind scalar parser boundary.
  if (typeof value !== "number") {
    throw new TypeError(`Cannot convert "${String(value)}" to double`);
  }
  return value;
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
