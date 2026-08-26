import { OpenCvInputError } from "./error.js";

/** OpenCV AKAZE descriptor representation. */
export enum AKAZEDescriptorType {
  KAZE_UPRIGHT = 2,
  KAZE = 3,
  MLDB_UPRIGHT = 4,
  MLDB = 5,
}

/** OpenCV nonlinear diffusion method used by AKAZE. */
export enum KAZEDiffusivity {
  PM_G1 = 0,
  PM_G2 = 1,
  WEICKERT = 2,
  CHARBONNIER = 3,
}

/** Optional configuration accepted by `OpenCv.createAKAZE`. */
export interface AKAZEOptions {
  readonly descriptorChannels?: 1 | 2 | 3;
  readonly descriptorSize?: number;
  readonly descriptorType?: AKAZEDescriptorType;
  readonly diffusivity?: KAZEDiffusivity;
  readonly maxPoints?: number;
  readonly octaveLayers?: number;
  readonly octaves?: number;
  readonly threshold?: number;
}

/** OpenCV 4.13 defaults used when AKAZE options are omitted. */
export const AKAZE_DEFAULTS: Readonly<Required<AKAZEOptions>> = Object.freeze({
  descriptorChannels: 3,
  descriptorSize: 0,
  descriptorType: AKAZEDescriptorType.MLDB,
  diffusivity: KAZEDiffusivity.PM_G2,
  maxPoints: -1,
  octaveLayers: 4,
  octaves: 4,
  threshold: 0.001,
});

/** Low-level AKAZE object returned by the generated WebAssembly module. */
export interface WasmAKAZEHandle {
  free(): void;
  getDefaultName(): string;
  getDescriptorChannels(): number;
  getDescriptorSize(): number;
  getDescriptorType(): number;
  getDiffusivity(): number;
  getNOctaveLayers(): number;
  getNOctaves(): number;
  getThreshold(): number;
  setDescriptorChannels(value: number): void;
  setDescriptorSize(value: number): void;
  setDescriptorType(value: number): void;
  setDiffusivity(value: number): void;
  setNOctaveLayers(value: number): void;
  setNOctaves(value: number): void;
  setThreshold(value: number): void;
}

/** Static constructor contract exposed by wasm-bindgen's `AKAZE` class. */
export interface WasmAKAZEFactory {
  create(
    descriptorType?: number | null,
    descriptorSize?: number | null,
    descriptorChannels?: number | null,
    threshold?: number | null,
    octaves?: number | null,
    octaveLayers?: number | null,
    diffusivity?: number | null,
    maxPoints?: number | null,
  ): WasmAKAZEHandle;
}

/** Rust-owned AKAZE configuration with an explicit lifetime. */
export class AKAZE {
  #handle: WasmAKAZEHandle | undefined;

  /** Low-level adapters may construct AKAZE from a compatible WASM handle. */
  constructor(handle: WasmAKAZEHandle) {
    this.#handle = handle;
  }

  getDefaultName(): string {
    return this.#owned().getDefaultName();
  }

  getDescriptorChannels(): 1 | 2 | 3 {
    return descriptorChannelsFromNumber(this.#owned().getDescriptorChannels());
  }

  getDescriptorSize(): number {
    return this.#owned().getDescriptorSize();
  }

  getDescriptorType(): AKAZEDescriptorType {
    return descriptorTypeFromNumber(this.#owned().getDescriptorType());
  }

  getDiffusivity(): KAZEDiffusivity {
    return diffusivityFromNumber(this.#owned().getDiffusivity());
  }

  getNOctaveLayers(): number {
    return this.#owned().getNOctaveLayers();
  }

  getNOctaves(): number {
    return this.#owned().getNOctaves();
  }

  getThreshold(): number {
    return this.#owned().getThreshold();
  }

  setDescriptorChannels(value: 1 | 2 | 3): void {
    validateDescriptorChannels(value);
    this.#owned().setDescriptorChannels(value);
  }

  setDescriptorSize(value: number): void {
    validateNonNegativeI32(value, "AKAZE descriptor size");
    this.#owned().setDescriptorSize(value);
  }

  setDescriptorType(value: AKAZEDescriptorType): void {
    validateDescriptorType(value);
    this.#owned().setDescriptorType(value);
  }

  setDiffusivity(value: KAZEDiffusivity): void {
    validateDiffusivity(value);
    this.#owned().setDiffusivity(value);
  }

  setNOctaveLayers(value: number): void {
    validatePositiveI32(value, "AKAZE octave layer count");
    this.#owned().setNOctaveLayers(value);
  }

  setNOctaves(value: number): void {
    validatePositiveI32(value, "AKAZE octave count");
    this.#owned().setNOctaves(value);
  }

  setThreshold(value: number): void {
    validateThreshold(value);
    this.#owned().setThreshold(value);
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

  #owned(): WasmAKAZEHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new OpenCvInputError("AKAZE has been disposed");
    }
    return handle;
  }
}

export function validateAKAZEOptions(options: AKAZEOptions): void {
  if (options.descriptorType !== undefined) {
    validateDescriptorType(options.descriptorType);
  }
  if (options.descriptorSize !== undefined) {
    validateNonNegativeI32(options.descriptorSize, "AKAZE descriptor size");
  }
  if (options.descriptorChannels !== undefined) {
    validateDescriptorChannels(options.descriptorChannels);
  }
  if (options.threshold !== undefined) {
    validateThreshold(options.threshold);
  }
  if (options.octaves !== undefined) {
    validatePositiveI32(options.octaves, "AKAZE octave count");
  }
  if (options.octaveLayers !== undefined) {
    validatePositiveI32(options.octaveLayers, "AKAZE octave layer count");
  }
  if (options.diffusivity !== undefined) {
    validateDiffusivity(options.diffusivity);
  }
  if (options.maxPoints !== undefined) {
    validateI32(options.maxPoints, "AKAZE maximum point count");
  }
}

function validateDescriptorType(value: AKAZEDescriptorType): void {
  if (
    value !== AKAZEDescriptorType.KAZE_UPRIGHT &&
    value !== AKAZEDescriptorType.KAZE &&
    value !== AKAZEDescriptorType.MLDB_UPRIGHT &&
    value !== AKAZEDescriptorType.MLDB
  ) {
    throw new OpenCvInputError("AKAZE descriptor type must be 2, 3, 4, or 5");
  }
}

function validateDescriptorChannels(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 3) {
    throw new OpenCvInputError("AKAZE descriptor channels must be 1, 2, or 3");
  }
}

function validateDiffusivity(value: KAZEDiffusivity): void {
  if (
    value !== KAZEDiffusivity.PM_G1 &&
    value !== KAZEDiffusivity.PM_G2 &&
    value !== KAZEDiffusivity.WEICKERT &&
    value !== KAZEDiffusivity.CHARBONNIER
  ) {
    throw new OpenCvInputError("AKAZE diffusivity must be 0, 1, 2, or 3");
  }
}

function descriptorChannelsFromNumber(value: number): 1 | 2 | 3 {
  switch (value) {
    case 1:
    case 2:
    case 3:
      return value;
    default:
      throw new OpenCvInputError(`unsupported AKAZE descriptor channel count ${value}`);
  }
}

function descriptorTypeFromNumber(value: number): AKAZEDescriptorType {
  switch (value) {
    case 2:
    case 3:
    case 4:
    case 5:
      return value;
    default:
      throw new OpenCvInputError(`unsupported AKAZE descriptor type ${value}`);
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
      throw new OpenCvInputError(`unsupported AKAZE diffusivity ${value}`);
  }
}

function validateThreshold(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new OpenCvInputError("AKAZE threshold must be finite and zero or greater");
  }
}

function validateNonNegativeI32(value: number, name: string): void {
  validateI32(value, name);
  if (value < 0) {
    throw new OpenCvInputError(`${name} must be zero or greater`);
  }
}

function validatePositiveI32(value: number, name: string): void {
  validateI32(value, name);
  if (value <= 0) {
    throw new OpenCvInputError(`${name} must be greater than zero`);
  }
}

function validateI32(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < -2_147_483_648 || value > 2_147_483_647) {
    throw new OpenCvInputError(`${name} must be a signed 32-bit integer`);
  }
}
