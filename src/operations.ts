/** Operations implemented by both the public TypeScript API and the Rust backend. */
export const OPENCV_OPERATIONS = [
  { method: "grayscale", wasmExport: "grayscaleRgba" },
  { method: "invert", wasmExport: "invertRgba" },
  { method: "resizeNearest", wasmExport: "resizeNearestRgba" },
  { method: "threshold", wasmExport: "thresholdRgba" },
] as const;

/** Name of an implemented TypeScript operation. */
export type OpenCvOperation = (typeof OPENCV_OPERATIONS)[number]["method"];
