import { createOpenCv } from "./client.js";
import type { OpenCvBackend } from "./types.js";

export { createOpenCv } from "./client.js";
export { OpenCvInputError } from "./error.js";
export { createRgbaImage, imageDataFromRgbaImage, rgbaImageFromImageData } from "./image.js";
export { OPENCV_OPERATIONS } from "./operations.js";
export type { OpenCvOperation } from "./operations.js";
export { Mat } from "./mat.js";
export type { MatDepth, WasmMatHandle } from "./mat.js";
export type {
  BorderType,
  DecompositionMethod,
  HanningWindowDepth,
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
