import { BindingError, OpenCvInputError } from "./error.js";
import { createEmbindEnumNamespace, enumInputToI32 } from "./embind-enum.js";
import type { EmbindEnumInput, EmbindEnumValue } from "./embind-enum.js";

interface EmbindObjectInput {
  toString(): string;
}

type EmbindScalarInput = boolean | number | EmbindObjectInput | string | null | undefined;

/** ORB keypoint ranking strategy. */
export enum ORBScoreType {
  HARRIS_SCORE = 0,
  FAST_SCORE = 1,
}

export interface ORB_ScoreTypeValue extends EmbindEnumValue {}

export interface ORB_ScoreTypeNamespace extends Function {
  HARRIS_SCORE: ORB_ScoreTypeValue;
  FAST_SCORE: ORB_ScoreTypeValue;
  readonly prototype: ORB_ScoreTypeValue;
  readonly values: Readonly<Record<number, ORB_ScoreTypeValue>>;
}

/** OpenCV.js-compatible ORB score-type enum namespace. */
export const ORB_ScoreType = createEmbindEnumNamespace<ORB_ScoreTypeNamespace>("ORB_ScoreType", [
  ["HARRIS_SCORE", 0],
  ["FAST_SCORE", 1],
]);

/** Numeric global aliases present in the pinned OpenCV.js artifact. */
export const ORB_HARRIS_SCORE = 0 as const;
export const ORB_FAST_SCORE = 1 as const;

/** Optional configuration accepted by the package `createORB` convenience. */
export interface ORBOptions {
  readonly edgeThreshold?: number;
  readonly fastThreshold?: number;
  readonly firstLevel?: number;
  readonly maxFeatures?: number;
  readonly nLevels?: number;
  readonly patchSize?: number;
  readonly scaleFactor?: number;
  readonly scoreType?: ORBScoreType;
  readonly wtaK?: number;
}

/** OpenCV 4.13 defaults used by the direct ORB constructor. */
export const ORB_DEFAULTS: Readonly<Required<ORBOptions>> = Object.freeze({
  edgeThreshold: 31,
  fastThreshold: 20,
  firstLevel: 0,
  maxFeatures: 500,
  nLevels: 8,
  patchSize: 31,
  scaleFactor: Math.fround(1.2),
  scoreType: ORBScoreType.HARRIS_SCORE,
  wtaK: 2,
});

/** Low-level ORB object returned by the generated WebAssembly module. */
export interface WasmORBHandle {
  free(): void;
  getDefaultName(): string;
  getFastThreshold(): number;
  setEdgeThreshold(value: number): void;
  setFastThreshold(value: number): void;
  setFirstLevel(value: number): void;
  setMaxFeatures(value: number): void;
  setNLevels(value: number): void;
  setPatchSize(value: number): void;
  setScaleFactor(value: number): void;
  setScoreType(value: number): void;
  setWTA_K(value: number): void;
}

/** Static constructor contract exposed by wasm-bindgen's ORB class. */
export interface WasmORBFactory {
  create(
    maxFeatures?: number | null,
    scaleFactor?: number | null,
    nLevels?: number | null,
    edgeThreshold?: number | null,
    firstLevel?: number | null,
    wtaK?: number | null,
    scoreType?: number | null,
    patchSize?: number | null,
    fastThreshold?: number | null,
  ): WasmORBHandle;
}

/** Rust-owned ORB configuration with an explicit lifetime. */
export class ORB {
  #handle: WasmORBHandle | undefined;

  /** Low-level adapters may construct ORB from a compatible WASM handle. */
  constructor(handle: WasmORBHandle) {
    this.#handle = handle;
  }

  getDefaultName(): string {
    requireExactArity(arguments.length, 0, "ORB.getDefaultName");
    return this.#owned().getDefaultName();
  }

  getFastThreshold(): number {
    requireExactArity(arguments.length, 0, "ORB.getFastThreshold");
    return this.#ownedConst().getFastThreshold();
  }

  setEdgeThreshold(value: number): void {
    requireExactArity(arguments.length, 1, "ORB.setEdgeThreshold");
    this.#owned().setEdgeThreshold(toWasmI32(value));
  }

  setFastThreshold(value: number): void {
    requireExactArity(arguments.length, 1, "ORB.setFastThreshold");
    this.#owned().setFastThreshold(toWasmI32(value));
  }

  setFirstLevel(value: number): void {
    requireExactArity(arguments.length, 1, "ORB.setFirstLevel");
    this.#owned().setFirstLevel(toWasmI32(value));
  }

  setMaxFeatures(value: number): void {
    requireExactArity(arguments.length, 1, "ORB.setMaxFeatures");
    this.#owned().setMaxFeatures(toWasmI32(value));
  }

  setNLevels(value: number): void {
    requireExactArity(arguments.length, 1, "ORB.setNLevels");
    this.#owned().setNLevels(toWasmI32(value));
  }

  setPatchSize(value: number): void {
    requireExactArity(arguments.length, 1, "ORB.setPatchSize");
    this.#owned().setPatchSize(toWasmI32(value));
  }

  setScaleFactor(value: number): void {
    requireExactArity(arguments.length, 1, "ORB.setScaleFactor");
    this.#owned().setScaleFactor(toWasmF64(value));
  }

  setScoreType(value: ORB_ScoreTypeValue | EmbindEnumInput): void {
    requireExactArity(arguments.length, 1, "ORB.setScoreType");
    this.#owned().setScoreType(enumInputToI32(value));
  }

  setWTA_K(value: number): void {
    requireExactArity(arguments.length, 1, "ORB.setWTA_K");
    this.#owned().setWTA_K(toWasmI32(value));
  }

  /** Releases the WASM handle with OpenCV.js-compatible repeated-delete behavior. */
  delete(): void {
    if (this.#handle === undefined) {
      throw new BindingError("ORB instance already deleted");
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

  #owned(): WasmORBHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new BindingError("Cannot pass deleted object as a pointer of type ORB");
    }
    return handle;
  }

  #ownedConst(): WasmORBHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new BindingError("Cannot pass deleted object as a pointer of type ORB const*");
    }
    return handle;
  }
}

export function validateORBOptions(options: ORBOptions): void {
  for (const [name, value] of [
    ["ORB edge threshold", options.edgeThreshold],
    ["ORB fast threshold", options.fastThreshold],
    ["ORB maximum feature count", options.maxFeatures],
    ["ORB level count", options.nLevels],
    ["ORB patch size", options.patchSize],
    ["ORB WTA_K", options.wtaK],
  ] as const) {
    if (value !== undefined) validateI32(value, name);
  }
  if (options.firstLevel !== undefined) {
    validateI32(options.firstLevel, "ORB first level");
    if (options.firstLevel < 0) {
      throw new OpenCvInputError("ORB first level must be zero or greater");
    }
  }
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Public JavaScript input is validated before crossing into WASM.
  if (options.scaleFactor !== undefined && typeof options.scaleFactor !== "number") {
    throw new OpenCvInputError("ORB scale factor must be a number");
  }
  if (
    options.scoreType !== undefined &&
    options.scoreType !== ORBScoreType.HARRIS_SCORE &&
    options.scoreType !== ORBScoreType.FAST_SCORE
  ) {
    throw new OpenCvInputError("ORB score type must be 0 or 1");
  }
}

function validateI32(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < -2_147_483_648 || value > 2_147_483_647) {
    throw new OpenCvInputError(`${name} must be a signed 32-bit integer`);
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

function requireExactArity(actual: number, expected: number, method: string): void {
  if (actual !== expected) {
    throw new BindingError(
      `function ${method} called with ${actual} arguments, expected ${expected} args!`,
    );
  }
}
