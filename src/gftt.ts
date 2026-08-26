import { OpenCvInputError } from "./error.js";

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
    return this.#owned().getBlockSize();
  }

  getDefaultName(): string {
    return this.#owned().getDefaultName();
  }

  getHarrisDetector(): boolean {
    return this.#owned().getHarrisDetector();
  }

  getK(): number {
    return this.#owned().getK();
  }

  getMaxFeatures(): number {
    return this.#owned().getMaxFeatures();
  }

  getMinDistance(): number {
    return this.#owned().getMinDistance();
  }

  getQualityLevel(): number {
    return this.#owned().getQualityLevel();
  }

  setBlockSize(value: number): void {
    validateSignedI32(value, "GFTT block size");
    this.#owned().setBlockSize(value);
  }

  setHarrisDetector(value: boolean): void {
    this.#owned().setHarrisDetector(value);
  }

  setK(value: number): void {
    this.#owned().setK(value);
  }

  setMaxFeatures(value: number): void {
    validateSignedI32(value, "GFTT maximum feature count");
    this.#owned().setMaxFeatures(value);
  }

  setMinDistance(value: number): void {
    this.#owned().setMinDistance(value);
  }

  setQualityLevel(value: number): void {
    this.#owned().setQualityLevel(value);
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
      throw new OpenCvInputError("GFTTDetector has been disposed");
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
