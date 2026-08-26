import type { WasmMatHandle } from "./mat.js";
import type { WasmAKAZEHandle } from "./akaze.js";
import type { WasmKAZEHandle } from "./kaze.js";
import type {
  WasmAgastFeatureDetectorHandle,
  WasmFastFeatureDetectorHandle,
} from "./feature-detectors.js";

declare module "#wasm" {
  export class AgastFeatureDetector implements WasmAgastFeatureDetectorHandle {
    private constructor();
    static create(
      threshold?: number | null,
      nonmaxSuppression?: boolean | null,
      type?: number | null,
    ): AgastFeatureDetector;
    free(): void;
    getDefaultName(): string;
    getNonmaxSuppression(): boolean;
    getThreshold(): number;
    getType(): number;
    setNonmaxSuppression(value: boolean): void;
    setThreshold(value: number): void;
    setType(value: number): void;
  }

  export class FastFeatureDetector implements WasmFastFeatureDetectorHandle {
    private constructor();
    static create(
      threshold?: number | null,
      nonmaxSuppression?: boolean | null,
      type?: number | null,
    ): FastFeatureDetector;
    free(): void;
    getDefaultName(): string;
    getNonmaxSuppression(): boolean;
    getThreshold(): number;
    getType(): number;
    setNonmaxSuppression(value: boolean): void;
    setThreshold(value: number): void;
    setType(value: number): void;
  }

  export class AKAZE implements WasmAKAZEHandle {
    private constructor();
    static create(
      descriptorType?: number | null,
      descriptorSize?: number | null,
      descriptorChannels?: number | null,
      threshold?: number | null,
      octaves?: number | null,
      octaveLayers?: number | null,
      diffusivity?: number | null,
      maxPoints?: number | null,
    ): AKAZE;
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

  export class KAZE implements WasmKAZEHandle {
    private constructor();
    static create(
      extended?: boolean | null,
      upright?: boolean | null,
      threshold?: number | null,
      octaves?: number | null,
      octaveLayers?: number | null,
      diffusivity?: number | null,
    ): KAZE;
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

  export default function initialize(): Promise<void>;
  export function initSync(input: { module: BufferSource | WebAssembly.Module }): void;

  export function grayscaleRgba(data: Uint8Array, width: number, height: number): Uint8Array;
  export function invertRgba(data: Uint8Array, width: number, height: number): Uint8Array;
  export function matFromU8(
    data: Uint8Array,
    rows: number,
    columns: number,
    channels: number,
  ): WasmMatHandle;
  export function matZerosU8(rows: number, columns: number, channels: number): WasmMatHandle;
  export function resizeNearestRgba(
    data: Uint8Array,
    width: number,
    height: number,
    targetWidth: number,
    targetHeight: number,
  ): Uint8Array;
  export function thresholdRgba(
    data: Uint8Array,
    width: number,
    height: number,
    threshold: number,
  ): Uint8Array;
}
