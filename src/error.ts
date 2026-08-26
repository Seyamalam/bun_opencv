/** Error raised when a JavaScript call violates an OpenCV.js binding contract. */
export class BindingError extends Error {
  override readonly name = "BindingError";
}

/** Error raised before invalid image data reaches WebAssembly. */
export class OpenCvInputError extends RangeError {
  override readonly name = "OpenCvInputError";
}
