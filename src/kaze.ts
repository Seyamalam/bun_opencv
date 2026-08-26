import { KAZEDiffusivity } from "./akaze.js";
import { BindingError, OpenCvInputError } from "./error.js";

interface EmbindObjectInput {
  toString(): string;
}

type EmbindScalarInput = boolean | number | EmbindObjectInput | string | null | undefined;

/** Optional configuration accepted by `OpenCv.createKAZE`. */
export interface KAZEOptions {
  readonly diffusivity?: KAZEDiffusivity;
  readonly extended?: boolean;
  readonly octaveLayers?: number;
  readonly octaves?: number;
  readonly threshold?: number;
  readonly upright?: boolean;
}

/** OpenCV 4.13 defaults used when KAZE options are omitted. */
export const KAZE_DEFAULTS: Readonly<Required<KAZEOptions>> = Object.freeze({
  diffusivity: KAZEDiffusivity.PM_G2,
  extended: false,
  octaveLayers: 4,
  octaves: 4,
  threshold: 0.0010000000474974513,
  upright: false,
});

/** Low-level KAZE object returned by the generated WebAssembly module. */
export interface WasmKAZEHandle {
  free(): void;
  getDefaultName(): string;
  getDiffusivity(): number;
  getExtended(): boolean;
  getNOctaveLayers(): number;
  getNOctaves(): number;
  getThreshold(): number;
  getUpright(): boolean;
  setDiffusivity(value: number): void;
  setExtended(value: boolean): void;
  setNOctaveLayers(value: number): void;
  setNOctaves(value: number): void;
  setThreshold(value: number): void;
  setUpright(value: boolean): void;
}

/** Static constructor contract exposed by wasm-bindgen's `KAZE` class. */
export interface WasmKAZEFactory {
  create(
    extended?: boolean | null,
    upright?: boolean | null,
    threshold?: number | null,
    octaves?: number | null,
    octaveLayers?: number | null,
    diffusivity?: number | null,
  ): WasmKAZEHandle;
}

/** Rust-owned KAZE configuration with an explicit lifetime. */
export class KAZE {
  #handle: WasmKAZEHandle | undefined;

  /** Low-level adapters may construct KAZE from a compatible WASM handle. */
  constructor(handle: WasmKAZEHandle) {
    this.#handle = handle;
  }

  getDefaultName(): string {
    requireExactArity(arguments.length, 0, "KAZE.getDefaultName");
    return this.#owned().getDefaultName();
  }

  getDiffusivity(): KAZEDiffusivity {
    return diffusivityFromNumber(this.#owned().getDiffusivity());
  }

  getExtended(): boolean {
    requireExactArity(arguments.length, 0, "KAZE.getExtended");
    return this.#ownedConst().getExtended();
  }

  getNOctaveLayers(): number {
    requireExactArity(arguments.length, 0, "KAZE.getNOctaveLayers");
    return this.#ownedConst().getNOctaveLayers();
  }

  getNOctaves(): number {
    requireExactArity(arguments.length, 0, "KAZE.getNOctaves");
    return this.#ownedConst().getNOctaves();
  }

  getThreshold(): number {
    requireExactArity(arguments.length, 0, "KAZE.getThreshold");
    return this.#ownedConst().getThreshold();
  }

  getUpright(): boolean {
    requireExactArity(arguments.length, 0, "KAZE.getUpright");
    return this.#ownedConst().getUpright();
  }

  setDiffusivity(value: KAZEDiffusivity): void {
    validateDiffusivity(value);
    this.#owned().setDiffusivity(value);
  }

  setExtended(value: boolean): void {
    requireExactArity(arguments.length, 1, "KAZE.setExtended");
    this.#owned().setExtended(toWasmBoolean(value));
  }

  setNOctaveLayers(value: number): void {
    requireExactArity(arguments.length, 1, "KAZE.setNOctaveLayers");
    this.#owned().setNOctaveLayers(toWasmI32(value));
  }

  setNOctaves(value: number): void {
    requireExactArity(arguments.length, 1, "KAZE.setNOctaves");
    this.#owned().setNOctaves(toWasmI32(value));
  }

  setThreshold(value: number): void {
    requireExactArity(arguments.length, 1, "KAZE.setThreshold");
    this.#owned().setThreshold(toWasmF64(value));
  }

  setUpright(value: boolean): void {
    requireExactArity(arguments.length, 1, "KAZE.setUpright");
    this.#owned().setUpright(toWasmBoolean(value));
  }

  /** Releases the WASM handle with OpenCV.js-compatible repeated-delete behavior. */
  delete(): void {
    if (this.#handle === undefined) {
      throw new BindingError("KAZE instance already deleted");
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

  #owned(): WasmKAZEHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new BindingError("Cannot pass deleted object as a pointer of type KAZE");
    }
    return handle;
  }

  #ownedConst(): WasmKAZEHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new BindingError("Cannot pass deleted object as a pointer of type KAZE const*");
    }
    return handle;
  }
}

export function validateKAZEOptions(options: KAZEOptions): void {
  if (options.diffusivity !== undefined) {
    validateDiffusivity(options.diffusivity);
  }
  if (options.octaveLayers !== undefined) {
    validatePositiveI32(options.octaveLayers, "KAZE octave layer count");
  }
  if (options.octaves !== undefined) {
    validatePositiveI32(options.octaves, "KAZE octave count");
  }
  if (options.threshold !== undefined) {
    validateThreshold(options.threshold);
  }
}

function validateDiffusivity(value: KAZEDiffusivity): void {
  if (
    value !== KAZEDiffusivity.PM_G1 &&
    value !== KAZEDiffusivity.PM_G2 &&
    value !== KAZEDiffusivity.WEICKERT &&
    value !== KAZEDiffusivity.CHARBONNIER
  ) {
    throw new OpenCvInputError("KAZE diffusivity must be 0, 1, 2, or 3");
  }
}

function diffusivityFromNumber(value: number): KAZEDiffusivity {
  switch (value) {
    case 0:
    case 1:
    case 2:
    case 3:
      return value;
    default:
      throw new OpenCvInputError(`unsupported KAZE diffusivity ${value}`);
  }
}

function validateThreshold(value: number): void {
  if (!Number.isFinite(value)) {
    throw new OpenCvInputError("KAZE threshold must be finite");
  }
}

function validatePositiveI32(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647) {
    throw new OpenCvInputError(`${name} must be a positive signed 32-bit integer`);
  }
}

function toWasmI32(value: EmbindScalarInput): number {
  if (value === true) return 1;
  if (value === false) return 0;
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
  if (value === true) return 1;
  if (value === false) return 0;
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
