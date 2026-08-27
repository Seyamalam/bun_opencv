import { BindingError } from "./error.js";

interface EmbindObjectInput {
  toString(): string;
}

type EmbindFloatInput = boolean | number | EmbindObjectInput | string | null | undefined;

/** Shared low-level state contract implemented by every tone-mapping WASM handle. */
export interface WasmTonemapHandle {
  free(): void;
  getGamma(): number;
  setGamma(value: number): void;
}

/** Low-level Drago state returned by the generated WebAssembly module. */
export interface WasmTonemapDragoHandle extends WasmTonemapHandle {
  getBias(): number;
  getSaturation(): number;
  setBias(value: number): void;
  setSaturation(value: number): void;
}

/** Static constructor contract exposed by wasm-bindgen's Drago class. */
export interface WasmTonemapDragoFactory {
  create(
    gamma?: number | null,
    saturation?: number | null,
    bias?: number | null,
  ): WasmTonemapDragoHandle;
}

/** Low-level Mantiuk state returned by the generated WebAssembly module. */
export interface WasmTonemapMantiukHandle extends WasmTonemapHandle {
  getSaturation(): number;
  getScale(): number;
  setSaturation(value: number): void;
  setScale(value: number): void;
}

/** Static constructor contract exposed by wasm-bindgen's Mantiuk class. */
export interface WasmTonemapMantiukFactory {
  create(
    gamma?: number | null,
    scale?: number | null,
    saturation?: number | null,
  ): WasmTonemapMantiukHandle;
}

/** Low-level Reinhard state returned by the generated WebAssembly module. */
export interface WasmTonemapReinhardHandle extends WasmTonemapHandle {
  getColorAdaptation(): number;
  getIntensity(): number;
  getLightAdaptation(): number;
  setColorAdaptation(value: number): void;
  setIntensity(value: number): void;
  setLightAdaptation(value: number): void;
}

/** Static constructor contract exposed by wasm-bindgen's Reinhard class. */
export interface WasmTonemapReinhardFactory {
  create(
    gamma?: number | null,
    intensity?: number | null,
    lightAdaptation?: number | null,
    colorAdaptation?: number | null,
  ): WasmTonemapReinhardHandle;
}

/** Shared OpenCV.js-compatible gamma state and explicit WASM lifetime. */
export abstract class Tonemap<Handle extends WasmTonemapHandle = WasmTonemapHandle> {
  #className: string;
  #handle: Handle | undefined;

  protected constructor(handle: Handle, className: string) {
    this.#handle = handle;
    this.#className = className;
  }

  getGamma(): number {
    requireExactArity(arguments.length, 0, "Tonemap.getGamma");
    return this.ownedConst("Tonemap").getGamma();
  }

  setGamma(value: number): void {
    requireExactArity(arguments.length, 1, "Tonemap.setGamma");
    this.owned("Tonemap").setGamma(toWasmF32(value));
  }

  /** Releases the WASM handle with OpenCV.js-compatible repeated-delete behavior. */
  delete(): void {
    if (this.#handle === undefined) {
      throw new BindingError(`${this.#className} instance already deleted`);
    }
    this.dispose();
  }

  /** Releases the WASM handle. Repeated calls do nothing. */
  dispose(): void {
    const handle = this.#handle;
    if (handle === undefined) return;
    this.#handle = undefined;
    handle.free();
  }

  protected owned(pointerType: string): Handle {
    const handle = this.#handle;
    if (handle === undefined) {
      throw new BindingError(`Cannot pass deleted object as a pointer of type ${pointerType}`);
    }
    return handle;
  }

  protected ownedConst(pointerType: string): Handle {
    return this.owned(`${pointerType} const*`);
  }
}

/** Rust-owned Drago tone-mapping configuration. */
export class TonemapDrago extends Tonemap<WasmTonemapDragoHandle> {
  constructor(handle: WasmTonemapDragoHandle) {
    super(handle, "TonemapDrago");
  }

  getBias(): number {
    requireExactArity(arguments.length, 0, "TonemapDrago.getBias");
    return this.ownedConst("TonemapDrago").getBias();
  }

  getSaturation(): number {
    requireExactArity(arguments.length, 0, "TonemapDrago.getSaturation");
    return this.ownedConst("TonemapDrago").getSaturation();
  }

  setBias(value: number): void {
    requireExactArity(arguments.length, 1, "TonemapDrago.setBias");
    this.owned("TonemapDrago").setBias(toWasmF32(value));
  }

  setSaturation(value: number): void {
    requireExactArity(arguments.length, 1, "TonemapDrago.setSaturation");
    this.owned("TonemapDrago").setSaturation(toWasmF32(value));
  }
}

/** Rust-owned Mantiuk tone-mapping configuration. */
export class TonemapMantiuk extends Tonemap<WasmTonemapMantiukHandle> {
  constructor(handle: WasmTonemapMantiukHandle) {
    super(handle, "TonemapMantiuk");
  }

  getSaturation(): number {
    requireExactArity(arguments.length, 0, "TonemapMantiuk.getSaturation");
    return this.ownedConst("TonemapMantiuk").getSaturation();
  }

  getScale(): number {
    requireExactArity(arguments.length, 0, "TonemapMantiuk.getScale");
    return this.ownedConst("TonemapMantiuk").getScale();
  }

  setSaturation(value: number): void {
    requireExactArity(arguments.length, 1, "TonemapMantiuk.setSaturation");
    this.owned("TonemapMantiuk").setSaturation(toWasmF32(value));
  }

  setScale(value: number): void {
    requireExactArity(arguments.length, 1, "TonemapMantiuk.setScale");
    this.owned("TonemapMantiuk").setScale(toWasmF32(value));
  }
}

/** Rust-owned Reinhard tone-mapping configuration. */
export class TonemapReinhard extends Tonemap<WasmTonemapReinhardHandle> {
  constructor(handle: WasmTonemapReinhardHandle) {
    super(handle, "TonemapReinhard");
  }

  getColorAdaptation(): number {
    requireExactArity(arguments.length, 0, "TonemapReinhard.getColorAdaptation");
    return this.ownedConst("TonemapReinhard").getColorAdaptation();
  }

  getIntensity(): number {
    requireExactArity(arguments.length, 0, "TonemapReinhard.getIntensity");
    return this.ownedConst("TonemapReinhard").getIntensity();
  }

  getLightAdaptation(): number {
    requireExactArity(arguments.length, 0, "TonemapReinhard.getLightAdaptation");
    return this.ownedConst("TonemapReinhard").getLightAdaptation();
  }

  setColorAdaptation(value: number): void {
    requireExactArity(arguments.length, 1, "TonemapReinhard.setColorAdaptation");
    this.owned("TonemapReinhard").setColorAdaptation(toWasmF32(value));
  }

  setIntensity(value: number): void {
    requireExactArity(arguments.length, 1, "TonemapReinhard.setIntensity");
    this.owned("TonemapReinhard").setIntensity(toWasmF32(value));
  }

  setLightAdaptation(value: number): void {
    requireExactArity(arguments.length, 1, "TonemapReinhard.setLightAdaptation");
    this.owned("TonemapReinhard").setLightAdaptation(toWasmF32(value));
  }
}

function toWasmF32(value: EmbindFloatInput): number {
  if (value === true) return 1;
  if (value === false) return 0;
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- This is the JS-to-Embind scalar parser boundary.
  if (typeof value !== "number") {
    throw new TypeError(`Cannot convert "${String(value)}" to float`);
  }
  return Math.fround(value);
}

function requireExactArity(actual: number, expected: number, method: string): void {
  if (actual !== expected) {
    throw new BindingError(
      `function ${method} called with ${actual} arguments, expected ${expected} args!`,
    );
  }
}
