import { createOpenCv } from "./client.js";
import type { OpenCvBackend } from "./types.js";

export { createOpenCv } from "./client.js";
export { AKAZE, AKAZE_DEFAULTS, AKAZEDescriptorType, KAZEDiffusivity } from "./akaze.js";
export type { AKAZEOptions, WasmAKAZEFactory, WasmAKAZEHandle } from "./akaze.js";
export { KAZE, KAZE_DEFAULTS } from "./kaze.js";
export type { KAZEOptions, WasmKAZEFactory, WasmKAZEHandle } from "./kaze.js";
export { GFTT_DETECTOR_DEFAULTS, GFTTDetector } from "./gftt.js";
export type {
  GFTTDetectorOptions,
  WasmGFTTDetectorFactory,
  WasmGFTTDetectorHandle,
} from "./gftt.js";
export { OpenCvInputError } from "./error.js";
export {
  AGAST_FEATURE_DETECTOR_DEFAULTS,
  AgastFeatureDetector,
  AgastFeatureDetectorType,
  FAST_FEATURE_DETECTOR_DEFAULTS,
  FastFeatureDetector,
  FastFeatureDetectorType,
} from "./feature-detectors.js";
export type {
  AgastFeatureDetectorOptions,
  FastFeatureDetectorOptions,
  WasmAgastFeatureDetectorFactory,
  WasmAgastFeatureDetectorHandle,
  WasmFastFeatureDetectorFactory,
  WasmFastFeatureDetectorHandle,
} from "./feature-detectors.js";
export { createRgbaImage, imageDataFromRgbaImage, rgbaImageFromImageData } from "./image.js";
export { OPENCV_OPERATIONS } from "./operations.js";
export type { OpenCvOperation } from "./operations.js";
export { Mat } from "./mat.js";
export type { MatDepth, WasmMatHandle } from "./mat.js";
export type {
  BorderType,
  DecompositionMethod,
  HanningWindowDepth,
  LogLevel,
  MinMaxLocation,
  NormalizeType,
  NormType,
  OpenCv,
  OpenCvBackend,
  Point,
  Rect,
  RgbaImage,
  ReduceKind,
  Scalar,
  Size,
  StructuringElementKind,
} from "./types.js";

/** Loads the package WebAssembly module and returns an initialized client. */
export async function initOpenCv(): Promise<ReturnType<typeof createOpenCv>> {
  const backend: OpenCvBackend & { default(): Promise<void> } = await import("#wasm");
  await backend.default();
  return createOpenCv(backend);
}
