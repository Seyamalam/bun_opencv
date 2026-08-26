import { KAZEDiffusivity } from "./akaze.js";
import { OpenCvInputError } from "./error.js";

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
    return this.#owned().getDefaultName();
  }

  getDiffusivity(): KAZEDiffusivity {
    return diffusivityFromNumber(this.#owned().getDiffusivity());
  }

  getExtended(): boolean {
    return this.#owned().getExtended();
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

  getUpright(): boolean {
    return this.#owned().getUpright();
  }

  setDiffusivity(value: KAZEDiffusivity): void {
    validateDiffusivity(value);
    this.#owned().setDiffusivity(value);
  }

  setExtended(value: boolean): void {
    this.#owned().setExtended(value);
  }

  setNOctaveLayers(value: number): void {
    validatePositiveI32(value, "KAZE octave layer count");
    this.#owned().setNOctaveLayers(value);
  }

  setNOctaves(value: number): void {
    validatePositiveI32(value, "KAZE octave count");
    this.#owned().setNOctaves(value);
  }

  setThreshold(value: number): void {
    validateThreshold(value);
    this.#owned().setThreshold(value);
  }

  setUpright(value: boolean): void {
    this.#owned().setUpright(value);
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
      throw new OpenCvInputError("KAZE has been disposed");
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
