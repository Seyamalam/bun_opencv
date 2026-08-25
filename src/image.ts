import { OpenCvInputError } from "./error.js";
import type { RgbaImage } from "./types.js";

const RGBA_CHANNELS = 4;
const MAX_WASM_DIMENSION = 4_294_967_295;

export function validateDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_WASM_DIMENSION) {
    throw new OpenCvInputError(`${label} must be a positive 32-bit integer`);
  }
}

export function validateThreshold(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new OpenCvInputError("threshold must be an integer from 0 through 255");
  }
}

export function expectedRgbaLength(width: number, height: number): number {
  validateDimension(width, "width");
  validateDimension(height, "height");
  const byteLength = width * height * RGBA_CHANNELS;
  if (!Number.isSafeInteger(byteLength) || byteLength > MAX_WASM_DIMENSION) {
    throw new OpenCvInputError("image dimensions exceed the WASM buffer limit");
  }
  return byteLength;
}

export function validateRgbaImage(image: RgbaImage): void {
  const expected = expectedRgbaLength(image.width, image.height);
  if (image.data.byteLength !== expected) {
    throw new OpenCvInputError(
      `RGBA buffer has ${image.data.byteLength} bytes; expected ${expected} bytes`,
    );
  }
}

export function createRgbaImage(width: number, height: number, data: Uint8Array): RgbaImage {
  const image: RgbaImage = Object.freeze({
    data: new Uint8Array(data),
    height,
    width,
  });
  validateRgbaImage(image);
  return image;
}

export function rgbaImageFromImageData(imageData: ImageData): RgbaImage {
  return createRgbaImage(imageData.width, imageData.height, Uint8Array.from(imageData.data));
}

export function imageDataFromRgbaImage(image: RgbaImage): ImageData {
  validateRgbaImage(image);
  return new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
}
