/** Error raised before invalid image data reaches WebAssembly. */
export class OpenCvInputError extends RangeError {
  override readonly name = "OpenCvInputError";
}
