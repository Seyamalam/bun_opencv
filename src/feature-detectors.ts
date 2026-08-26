import { BindingError, OpenCvInputError } from "./error.js";
import { createEmbindEnumNamespace, enumInputToI32, enumValueFromI32 } from "./embind-enum.js";
import type { EmbindEnumInput, EmbindEnumValue } from "./embind-enum.js";

interface EmbindObjectInput {
  toString(): string;
}

type EmbindScalarInput = boolean | number | EmbindObjectInput | string | null | undefined;

/** Neighborhood pattern used by OpenCV's AGAST detector. */
export enum AgastFeatureDetectorType {
  AGAST_5_8 = 0,
  AGAST_7_12d = 1,
  AGAST_7_12s = 2,
  OAST_9_16 = 3,
}

/** Neighborhood pattern used by OpenCV's FAST detector. */
export enum FastFeatureDetectorType {
  TYPE_5_8 = 0,
  TYPE_7_12 = 1,
  TYPE_9_16 = 2,
}

export interface AgastFeatureDetector_DetectorTypeValue extends EmbindEnumValue {}

export interface AgastFeatureDetector_DetectorTypeNamespace extends Function {
  AGAST_5_8: AgastFeatureDetector_DetectorTypeValue;
  AGAST_7_12d: AgastFeatureDetector_DetectorTypeValue;
  AGAST_7_12s: AgastFeatureDetector_DetectorTypeValue;
  OAST_9_16: AgastFeatureDetector_DetectorTypeValue;
  readonly prototype: AgastFeatureDetector_DetectorTypeValue;
}

/** OpenCV.js-compatible AGAST detector-type enum namespace. */
export const AgastFeatureDetector_DetectorType =
  createEmbindEnumNamespace<AgastFeatureDetector_DetectorTypeNamespace>(
    "AgastFeatureDetector_DetectorType",
    [
      ["AGAST_5_8", 0],
      ["AGAST_7_12d", 1],
      ["AGAST_7_12s", 2],
      ["OAST_9_16", 3],
    ],
  );

export interface FastFeatureDetector_DetectorTypeValue extends EmbindEnumValue {}

export interface FastFeatureDetector_DetectorTypeNamespace extends Function {
  TYPE_5_8: FastFeatureDetector_DetectorTypeValue;
  TYPE_7_12: FastFeatureDetector_DetectorTypeValue;
  TYPE_9_16: FastFeatureDetector_DetectorTypeValue;
  readonly prototype: FastFeatureDetector_DetectorTypeValue;
}

/** OpenCV.js-compatible FAST detector-type enum namespace. */
export const FastFeatureDetector_DetectorType =
  createEmbindEnumNamespace<FastFeatureDetector_DetectorTypeNamespace>(
    "FastFeatureDetector_DetectorType",
    [
      ["TYPE_5_8", 0],
      ["TYPE_7_12", 1],
      ["TYPE_9_16", 2],
    ],
  );

const AGAST_TYPES = new Map<number, AgastFeatureDetector_DetectorTypeValue>([
  [0, AgastFeatureDetector_DetectorType.AGAST_5_8],
  [1, AgastFeatureDetector_DetectorType.AGAST_7_12d],
  [2, AgastFeatureDetector_DetectorType.AGAST_7_12s],
  [3, AgastFeatureDetector_DetectorType.OAST_9_16],
]);

const FAST_TYPES = new Map<number, FastFeatureDetector_DetectorTypeValue>([
  [0, FastFeatureDetector_DetectorType.TYPE_5_8],
  [1, FastFeatureDetector_DetectorType.TYPE_7_12],
  [2, FastFeatureDetector_DetectorType.TYPE_9_16],
]);

/** Optional configuration accepted by `OpenCv.createAgastFeatureDetector`. */
export interface AgastFeatureDetectorOptions {
  readonly nonmaxSuppression?: boolean;
  readonly threshold?: number;
  readonly type?: AgastFeatureDetectorType;
}

/** OpenCV 4.13 defaults used when AGAST options are omitted. */
export const AGAST_FEATURE_DETECTOR_DEFAULTS: Readonly<Required<AgastFeatureDetectorOptions>> =
  Object.freeze({
    nonmaxSuppression: true,
    threshold: 10,
    type: AgastFeatureDetectorType.OAST_9_16,
  });

/** Optional configuration accepted by `OpenCv.createFastFeatureDetector`. */
export interface FastFeatureDetectorOptions {
  readonly nonmaxSuppression?: boolean;
  readonly threshold?: number;
  readonly type?: FastFeatureDetectorType;
}

/** OpenCV 4.13 defaults used when FAST options are omitted. */
export const FAST_FEATURE_DETECTOR_DEFAULTS: Readonly<Required<FastFeatureDetectorOptions>> =
  Object.freeze({
    nonmaxSuppression: true,
    threshold: 10,
    type: FastFeatureDetectorType.TYPE_9_16,
  });

/** Low-level AGAST object returned by the generated WebAssembly module. */
export interface WasmAgastFeatureDetectorHandle {
  free(): void;
  getDefaultName(): string;
  getNonmaxSuppression(): boolean;
  getThreshold(): number;
  getType(): number;
  setNonmaxSuppression(value: boolean): void;
  setThreshold(value: number): void;
  setType(value: number): void;
}

/** Static constructor contract exposed by wasm-bindgen's `AgastFeatureDetector` class. */
export interface WasmAgastFeatureDetectorFactory {
  create(
    threshold?: number | null,
    nonmaxSuppression?: boolean | null,
    type?: number | null,
  ): WasmAgastFeatureDetectorHandle;
}

/** Low-level FAST object returned by the generated WebAssembly module. */
export interface WasmFastFeatureDetectorHandle {
  free(): void;
  getDefaultName(): string;
  getNonmaxSuppression(): boolean;
  getThreshold(): number;
  getType(): number;
  setNonmaxSuppression(value: boolean): void;
  setThreshold(value: number): void;
  setType(value: number): void;
}

/** Static constructor contract exposed by wasm-bindgen's `FastFeatureDetector` class. */
export interface WasmFastFeatureDetectorFactory {
  create(
    threshold?: number | null,
    nonmaxSuppression?: boolean | null,
    type?: number | null,
  ): WasmFastFeatureDetectorHandle;
}

/** Rust-owned AGAST configuration with an explicit lifetime. */
export class AgastFeatureDetector {
  #handle: WasmAgastFeatureDetectorHandle | undefined;

  /** Low-level adapters may construct a detector from a compatible WASM handle. */
  constructor(handle: WasmAgastFeatureDetectorHandle) {
    this.#handle = handle;
  }

  getDefaultName(): string {
    requireExactArity(arguments.length, 0, "AgastFeatureDetector.getDefaultName");
    return this.#owned().getDefaultName();
  }

  getNonmaxSuppression(): boolean {
    requireExactArity(arguments.length, 0, "AgastFeatureDetector.getNonmaxSuppression");
    return this.#ownedConst().getNonmaxSuppression();
  }

  getThreshold(): number {
    requireExactArity(arguments.length, 0, "AgastFeatureDetector.getThreshold");
    return this.#ownedConst().getThreshold();
  }

  getType(): AgastFeatureDetector_DetectorTypeValue | undefined {
    requireExactArity(arguments.length, 0, "AgastFeatureDetector.getType");
    return enumValueFromI32(AGAST_TYPES, this.#ownedConst().getType());
  }

  setNonmaxSuppression(value: boolean): void {
    requireExactArity(arguments.length, 1, "AgastFeatureDetector.setNonmaxSuppression");
    this.#owned().setNonmaxSuppression(toWasmBoolean(value));
  }

  setThreshold(value: number): void {
    requireExactArity(arguments.length, 1, "AgastFeatureDetector.setThreshold");
    this.#owned().setThreshold(toWasmI32(value));
  }

  setType(value: AgastFeatureDetector_DetectorTypeValue | EmbindEnumInput): void {
    requireExactArity(arguments.length, 1, "AgastFeatureDetector.setType");
    this.#owned().setType(enumInputToI32(value));
  }

  /** Releases the WASM handle with OpenCV.js-compatible repeated-delete behavior. */
  delete(): void {
    if (this.#handle === undefined) {
      throw new BindingError("AgastFeatureDetector instance already deleted");
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

  #owned(): WasmAgastFeatureDetectorHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new BindingError(
        "Cannot pass deleted object as a pointer of type AgastFeatureDetector",
      );
    }
    return handle;
  }

  #ownedConst(): WasmAgastFeatureDetectorHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new BindingError(
        "Cannot pass deleted object as a pointer of type AgastFeatureDetector const*",
      );
    }
    return handle;
  }
}

/** Rust-owned FAST configuration with an explicit lifetime. */
export class FastFeatureDetector {
  #handle: WasmFastFeatureDetectorHandle | undefined;

  /** Low-level adapters may construct a detector from a compatible WASM handle. */
  constructor(handle: WasmFastFeatureDetectorHandle) {
    this.#handle = handle;
  }

  getDefaultName(): string {
    requireExactArity(arguments.length, 0, "FastFeatureDetector.getDefaultName");
    return this.#owned().getDefaultName();
  }

  getNonmaxSuppression(): boolean {
    requireExactArity(arguments.length, 0, "FastFeatureDetector.getNonmaxSuppression");
    return this.#ownedConst().getNonmaxSuppression();
  }

  getThreshold(): number {
    requireExactArity(arguments.length, 0, "FastFeatureDetector.getThreshold");
    return this.#ownedConst().getThreshold();
  }

  getType(): FastFeatureDetector_DetectorTypeValue | undefined {
    requireExactArity(arguments.length, 0, "FastFeatureDetector.getType");
    return enumValueFromI32(FAST_TYPES, this.#ownedConst().getType());
  }

  setNonmaxSuppression(value: boolean): void {
    requireExactArity(arguments.length, 1, "FastFeatureDetector.setNonmaxSuppression");
    this.#owned().setNonmaxSuppression(toWasmBoolean(value));
  }

  setThreshold(value: number): void {
    requireExactArity(arguments.length, 1, "FastFeatureDetector.setThreshold");
    this.#owned().setThreshold(toWasmI32(value));
  }

  setType(value: FastFeatureDetector_DetectorTypeValue | EmbindEnumInput): void {
    requireExactArity(arguments.length, 1, "FastFeatureDetector.setType");
    this.#owned().setType(enumInputToI32(value));
  }

  /** Releases the WASM handle with OpenCV.js-compatible repeated-delete behavior. */
  delete(): void {
    if (this.#handle === undefined) {
      throw new BindingError("FastFeatureDetector instance already deleted");
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

  #owned(): WasmFastFeatureDetectorHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new BindingError("Cannot pass deleted object as a pointer of type FastFeatureDetector");
    }
    return handle;
  }

  #ownedConst(): WasmFastFeatureDetectorHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new BindingError(
        "Cannot pass deleted object as a pointer of type FastFeatureDetector const*",
      );
    }
    return handle;
  }
}

export function validateAgastFeatureDetectorOptions(options: AgastFeatureDetectorOptions): void {
  if (options.threshold !== undefined) {
    validateDetectorThreshold(options.threshold, "AGAST threshold");
  }
  if (options.type !== undefined) {
    validateAgastType(options.type);
  }
}

export function validateFastFeatureDetectorOptions(options: FastFeatureDetectorOptions): void {
  if (options.threshold !== undefined) {
    validateDetectorThreshold(options.threshold, "FAST threshold");
  }
  if (options.type !== undefined) {
    validateFastType(options.type);
  }
}

function validateAgastType(value: AgastFeatureDetectorType): void {
  if (
    value !== AgastFeatureDetectorType.AGAST_5_8 &&
    value !== AgastFeatureDetectorType.AGAST_7_12d &&
    value !== AgastFeatureDetectorType.AGAST_7_12s &&
    value !== AgastFeatureDetectorType.OAST_9_16
  ) {
    throw new OpenCvInputError("AGAST detector type must be 0, 1, 2, or 3");
  }
}

function validateFastType(value: FastFeatureDetectorType): void {
  if (
    value !== FastFeatureDetectorType.TYPE_5_8 &&
    value !== FastFeatureDetectorType.TYPE_7_12 &&
    value !== FastFeatureDetectorType.TYPE_9_16
  ) {
    throw new OpenCvInputError("FAST detector type must be 0, 1, or 2");
  }
}

function validateDetectorThreshold(value: number, name: string): void {
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
