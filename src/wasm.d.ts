import type { WasmMatHandle } from "./mat.js";

declare module "#wasm" {
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
