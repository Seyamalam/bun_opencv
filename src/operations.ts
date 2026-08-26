/** Public operation entry points backed by Rust and mapped to the parity ledger. */
export const OPENCV_OPERATIONS = [
  { method: "absdiff", wasmExport: "matAbsdiffU8" },
  { method: "add", wasmExport: "matAddU8" },
  { method: "bitwiseAnd", wasmExport: "matBitwiseAndU8" },
  { method: "bitwiseNot", wasmExport: "matBitwiseNotU8" },
  { method: "bitwiseOr", wasmExport: "matBitwiseOrU8" },
  { method: "bitwiseXor", wasmExport: "matBitwiseXorU8" },
  { method: "compareEqual", wasmExport: "matCompareEqU8" },
  { method: "countNonZero", wasmExport: "matCountNonZero" },
  { method: "flip", wasmExport: "matFlip" },
  { method: "grayscale", wasmExport: "grayscaleRgba" },
  { method: "inRange", wasmExport: "matInRangeU8" },
  { method: "max", wasmExport: "matMaxU8" },
  { method: "mean", wasmExport: "matMean" },
  { method: "merge", wasmExport: "matMerge" },
  { method: "min", wasmExport: "matMinU8" },
  { method: "minMaxLoc", wasmExport: "matMinMaxLoc" },
  { method: "resizeNearest", wasmExport: "resizeNearestRgba" },
  { method: "repeat", wasmExport: "matRepeat" },
  { method: "rotate", wasmExport: "matRotate" },
  { method: "subtract", wasmExport: "matSubtractU8" },
  { method: "split", wasmExport: "matSplit" },
  { method: "threshold", wasmExport: "thresholdRgba" },
  { method: "transpose", wasmExport: "matTranspose" },
  { method: "trace", wasmExport: "matTrace" },
] as const;

/** Name of a public operation tracked by the compatibility ledger. */
export type OpenCvOperation = (typeof OPENCV_OPERATIONS)[number]["method"];
