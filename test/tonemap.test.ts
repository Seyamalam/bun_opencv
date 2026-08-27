/* oxlint-disable anti-slop/no-reflect-apply, typescript/unbound-method -- These tests exercise the untyped JavaScript binding boundary. */
import { describe, expect, test } from "bun:test";

import { TonemapDrago, TonemapMantiuk, TonemapReinhard } from "../src/tonemap.js";
import type {
  WasmTonemapDragoHandle,
  WasmTonemapMantiukHandle,
  WasmTonemapReinhardHandle,
} from "../src/tonemap.js";

class FakeTonemapDragoHandle implements WasmTonemapDragoHandle {
  bias = Math.fround(0.85);
  freed = false;
  gamma = 1;
  saturation = 1;

  free(): void {
    this.freed = true;
  }

  getBias(): number {
    return this.bias;
  }

  getGamma(): number {
    return this.gamma;
  }

  getSaturation(): number {
    return this.saturation;
  }

  setBias(value: number): void {
    this.bias = value;
  }

  setGamma(value: number): void {
    this.gamma = value;
  }

  setSaturation(value: number): void {
    this.saturation = value;
  }
}

class FakeTonemapMantiukHandle implements WasmTonemapMantiukHandle {
  freed = false;
  gamma = 1;
  saturation = 1;
  scale = Math.fround(0.7);

  free(): void {
    this.freed = true;
  }

  getGamma(): number {
    return this.gamma;
  }

  getSaturation(): number {
    return this.saturation;
  }

  getScale(): number {
    return this.scale;
  }

  setGamma(value: number): void {
    this.gamma = value;
  }

  setSaturation(value: number): void {
    this.saturation = value;
  }

  setScale(value: number): void {
    this.scale = value;
  }
}

class FakeTonemapReinhardHandle implements WasmTonemapReinhardHandle {
  colorAdaptation = 0;
  freed = false;
  gamma = 1;
  intensity = 0;
  lightAdaptation = 1;

  free(): void {
    this.freed = true;
  }

  getColorAdaptation(): number {
    return this.colorAdaptation;
  }

  getGamma(): number {
    return this.gamma;
  }

  getIntensity(): number {
    return this.intensity;
  }

  getLightAdaptation(): number {
    return this.lightAdaptation;
  }

  setColorAdaptation(value: number): void {
    this.colorAdaptation = value;
  }

  setGamma(value: number): void {
    this.gamma = value;
  }

  setIntensity(value: number): void {
    this.intensity = value;
  }

  setLightAdaptation(value: number): void {
    this.lightAdaptation = value;
  }
}

describe("Tonemap state wrappers", () => {
  test("Drago exposes exact f32 state and lifetime contracts", () => {
    const handle = new FakeTonemapDragoHandle();
    const tonemap = new TonemapDrago(handle);

    expect(tonemap.getGamma.length).toBe(0);
    expect(tonemap.setGamma.length).toBe(1);
    expect(tonemap.getBias()).toBe(Math.fround(0.85));
    expect(tonemap.getSaturation()).toBe(1);

    expect(tonemap.setGamma(1 / 3)).toBeUndefined();
    expect(tonemap.setBias(-0)).toBeUndefined();
    expect(tonemap.setSaturation(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(tonemap.getGamma()).toBe(Math.fround(1 / 3));
    expect(Object.is(tonemap.getBias(), -0)).toBe(true);
    expect(tonemap.getSaturation()).toBe(Number.POSITIVE_INFINITY);

    expect(() => Reflect.apply(tonemap.setGamma, tonemap, [])).toThrow(
      "function Tonemap.setGamma called with 0 arguments, expected 1 args!",
    );
    expect(() => Reflect.apply(tonemap.getBias, tonemap, [1])).toThrow(
      "function TonemapDrago.getBias called with 1 arguments, expected 0 args!",
    );
    expect(() => Reflect.apply(tonemap.setGamma, tonemap, ["2.5"])).toThrow(
      new TypeError('Cannot convert "2.5" to float'),
    );

    expect(tonemap.delete()).toBeUndefined();
    expect(handle.freed).toBe(true);
    expect(() => tonemap.getGamma()).toThrow(
      "Cannot pass deleted object as a pointer of type Tonemap const*",
    );
    expect(() => tonemap.setBias(1)).toThrow(
      "Cannot pass deleted object as a pointer of type TonemapDrago",
    );
    expect(() => tonemap.delete()).toThrow("TonemapDrago instance already deleted");
  });

  test("Mantiuk exposes inherited gamma and concrete state", () => {
    const handle = new FakeTonemapMantiukHandle();
    const tonemap = new TonemapMantiuk(handle);

    expect(tonemap.getGamma()).toBe(1);
    expect(tonemap.getScale()).toBe(Math.fround(0.7));
    expect(tonemap.getSaturation()).toBe(1);

    tonemap.setGamma(Number.NaN);
    tonemap.setScale(-2.25);
    Reflect.apply(tonemap.setSaturation, tonemap, [true]);

    expect(tonemap.getGamma()).toBeNaN();
    expect(tonemap.getScale()).toBe(-2.25);
    expect(tonemap.getSaturation()).toBe(1);
    expect(() => Reflect.apply(tonemap.setScale, tonemap, [1, 2])).toThrow(
      "function TonemapMantiuk.setScale called with 2 arguments, expected 1 args!",
    );

    tonemap.delete();
    expect(handle.freed).toBe(true);
    expect(() => tonemap.getScale()).toThrow(
      "Cannot pass deleted object as a pointer of type TonemapMantiuk const*",
    );
  });

  test("Reinhard exposes inherited gamma and adaptation state", () => {
    const handle = new FakeTonemapReinhardHandle();
    const tonemap = new TonemapReinhard(handle);

    expect([
      tonemap.getGamma(),
      tonemap.getIntensity(),
      tonemap.getLightAdaptation(),
      tonemap.getColorAdaptation(),
    ]).toEqual([1, 0, 1, 0]);

    tonemap.setGamma(Number.NEGATIVE_INFINITY);
    tonemap.setIntensity(-2.25);
    tonemap.setLightAdaptation(Number.NaN);
    tonemap.setColorAdaptation(-0);

    expect(tonemap.getGamma()).toBe(Number.NEGATIVE_INFINITY);
    expect(tonemap.getIntensity()).toBe(-2.25);
    expect(tonemap.getLightAdaptation()).toBeNaN();
    expect(Object.is(tonemap.getColorAdaptation(), -0)).toBe(true);
    expect(() => Reflect.apply(tonemap.getIntensity, tonemap, [1])).toThrow(
      "function TonemapReinhard.getIntensity called with 1 arguments, expected 0 args!",
    );

    tonemap.delete();
    expect(handle.freed).toBe(true);
    expect(() => tonemap.setColorAdaptation(1)).toThrow(
      "Cannot pass deleted object as a pointer of type TonemapReinhard",
    );
  });
});
