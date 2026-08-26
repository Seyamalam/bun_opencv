import type { WasmMatHandle } from "./mat.js";
import type { WasmAKAZEHandle } from "./akaze.js";

declare module "#wasm" {
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
