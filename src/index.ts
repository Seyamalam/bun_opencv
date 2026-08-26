import { createOpenCv } from "./client.js";
import type { OpenCvBackend } from "./types.js";

export { createOpenCv } from "./client.js";
export {
  AKAZE,
  AKAZE_DEFAULTS,
  AKAZE_DescriptorType,
  AKAZEDescriptorType,
  KAZE_DiffusivityType,
  KAZEDiffusivity,
} from "./akaze.js";
export type {
  AKAZE_DescriptorTypeNamespace,
  AKAZE_DescriptorTypeValue,
  AKAZEOptions,
  KAZE_DiffusivityTypeNamespace,
  KAZE_DiffusivityTypeValue,
  WasmAKAZEFactory,
  WasmAKAZEHandle,
} from "./akaze.js";
export { KAZE, KAZE_DEFAULTS } from "./kaze.js";
export type { KAZEOptions, WasmKAZEFactory, WasmKAZEHandle } from "./kaze.js";
export { GFTT_DETECTOR_DEFAULTS, GFTTDetector } from "./gftt.js";
export type {
  GFTTDetectorOptions,
  WasmGFTTDetectorFactory,
  WasmGFTTDetectorHandle,
} from "./gftt.js";
export { BindingError, OpenCvInputError } from "./error.js";
export type { EmbindEnumInput, EmbindEnumValue } from "./embind-enum.js";
export {
  AGAST_FEATURE_DETECTOR_DEFAULTS,
  AgastFeatureDetector,
  AgastFeatureDetector_DetectorType,
  AgastFeatureDetectorType,
  FAST_FEATURE_DETECTOR_DEFAULTS,
  FastFeatureDetector,
  FastFeatureDetector_DetectorType,
  FastFeatureDetectorType,
} from "./feature-detectors.js";
export type {
  AgastFeatureDetector_DetectorTypeNamespace,
  AgastFeatureDetector_DetectorTypeValue,
  AgastFeatureDetectorOptions,
  FastFeatureDetector_DetectorTypeNamespace,
  FastFeatureDetector_DetectorTypeValue,
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
