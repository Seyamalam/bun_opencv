import { OpenCvInputError } from "./error.js";

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
    return this.#owned().getDefaultName();
  }

  getNonmaxSuppression(): boolean {
    return this.#owned().getNonmaxSuppression();
  }

  getThreshold(): number {
    return this.#owned().getThreshold();
  }

  getType(): AgastFeatureDetectorType {
    return agastTypeFromNumber(this.#owned().getType());
  }

  setNonmaxSuppression(value: boolean): void {
    this.#owned().setNonmaxSuppression(value);
  }

  setThreshold(value: number): void {
    validateDetectorThreshold(value, "AGAST threshold");
    this.#owned().setThreshold(value);
  }

  setType(value: AgastFeatureDetectorType): void {
    validateAgastType(value);
    this.#owned().setType(value);
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
      throw new OpenCvInputError("AgastFeatureDetector has been disposed");
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
    return this.#owned().getDefaultName();
  }

  getNonmaxSuppression(): boolean {
    return this.#owned().getNonmaxSuppression();
  }

  getThreshold(): number {
    return this.#owned().getThreshold();
  }

  getType(): FastFeatureDetectorType {
    return fastTypeFromNumber(this.#owned().getType());
  }

  setNonmaxSuppression(value: boolean): void {
    this.#owned().setNonmaxSuppression(value);
  }

  setThreshold(value: number): void {
    validateDetectorThreshold(value, "FAST threshold");
    this.#owned().setThreshold(value);
  }

  setType(value: FastFeatureDetectorType): void {
    validateFastType(value);
    this.#owned().setType(value);
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
      throw new OpenCvInputError("FastFeatureDetector has been disposed");
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

function agastTypeFromNumber(value: number): AgastFeatureDetectorType {
  switch (value) {
    case 0:
    case 1:
    case 2:
    case 3:
      return value;
    default:
      throw new OpenCvInputError(`unsupported AGAST detector type ${value}`);
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

function fastTypeFromNumber(value: number): FastFeatureDetectorType {
  switch (value) {
    case 0:
    case 1:
    case 2:
      return value;
    default:
      throw new OpenCvInputError(`unsupported FAST detector type ${value}`);
  }
}

function validateDetectorThreshold(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
    throw new OpenCvInputError(`${name} must be an integer between 0 and 255`);
  }
}
