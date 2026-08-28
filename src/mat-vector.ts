import { BindingError, OpenCvInputError } from "./error.js";
import { Mat } from "./mat.js";
import type { WasmMatHandle } from "./mat.js";

/** Low-level Rust-owned vector handle returned by WebAssembly. */
export interface WasmMatVectorHandle {
  clear(): void;
  free(): void;
  get(index: number): WasmMatHandle;
  push_back(value: WasmMatHandle): void;
  size(): number;
}

/** Rust-owned matrix vector used by OpenCV-compatible output APIs. */
export class MatVector {
  #handle: WasmMatVectorHandle | undefined;

  constructor(handle: WasmMatVectorHandle) {
    this.#handle = handle;
  }

  size(): number {
    return this.#owned().size();
  }

  get(index: number): Mat {
    if (!Number.isSafeInteger(index) || index < 0 || index > 4_294_967_295) {
      throw new OpenCvInputError("MatVector index must be a non-negative 32-bit integer");
    }
    return new Mat(this.#owned().get(index));
  }

  push_back(value: Mat): void {
    this.#owned().push_back(value.handleForBackend());
  }

  clear(): void {
    this.#owned().clear();
  }

  handleForBackend(): WasmMatVectorHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new BindingError("Cannot pass deleted object as a pointer of type MatVector");
    }
    return handle;
  }

  dispose(): void {
    const handle = this.#handle;
    if (handle === undefined) return;
    this.#handle = undefined;
    handle.free();
  }

  delete(): void {
    this.dispose();
  }

  #owned(): WasmMatVectorHandle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new BindingError("Cannot call MatVector method after deletion");
    }
    return handle;
  }
}
