/* oxlint-disable anti-slop/no-reflect-apply, typescript/unbound-method -- These tests exercise the untyped JavaScript binding boundary. */
import { describe, expect, test } from "bun:test";

import { BindingError } from "../src/error.js";
import { MSER, MSER_DEFAULTS, validateMSEROptions, type WasmMSERHandle } from "../src/mser.js";

class FakeMSERHandle implements WasmMSERHandle {
  #delta: number = MSER_DEFAULTS.delta;
  #maxArea: number = MSER_DEFAULTS.maxArea;
  #minArea: number = MSER_DEFAULTS.minArea;
  #pass2Only: boolean = MSER_DEFAULTS.pass2Only;

  freeCount = 0;
  free(): void {
    this.freeCount += 1;
  }
  getDelta(): number {
    return this.#delta;
  }
  getMaxArea(): number {
    return this.#maxArea;
  }
  getMinArea(): number {
    return this.#minArea;
  }
  getPass2Only(): boolean {
    return this.#pass2Only;
  }
  getDefaultName(): string {
    return "Feature2D.MSER";
  }
  setDelta(value: number): void {
    this.#delta = value;
  }
  setMaxArea(value: number): void {
    this.#maxArea = value;
  }
  setMinArea(value: number): void {
    this.#minArea = value;
  }
  setPass2Only(value: boolean): void {
    this.#pass2Only = value;
  }
}

describe("MSER configuration", () => {
  test("validates integer factory options before crossing into WASM", () => {
    expect(() => validateMSEROptions({ delta: 1.5 })).toThrow(
      "MSER delta must be a signed 32-bit integer",
    );
    expect(() => validateMSEROptions({ minArea: -2_147_483_649 })).toThrow(
      "MSER minimum area must be a signed 32-bit integer",
    );
    expect(() => validateMSEROptions({ maxArea: 2_147_483_648 })).toThrow(
      "MSER maximum area must be a signed 32-bit integer",
    );
    expect(() => validateMSEROptions({ delta: -1, minArea: 0, maxArea: 14_400 })).not.toThrow();
  });

  test("exposes the OpenCV 4.13 defaults through the public wrapper", () => {
    const detector = new MSER(new FakeMSERHandle());

    expect(detector.getDefaultName()).toBe("Feature2D.MSER");
    expect(detector.getDelta()).toBe(5);
    expect(detector.getMinArea()).toBe(60);
    expect(detector.getMaxArea()).toBe(14_400);
    expect(detector.getPass2Only()).toBe(false);
  });

  test("mutates all four configuration fields", () => {
    const detector = new MSER(new FakeMSERHandle());

    detector.setDelta(-1);
    detector.setMinArea(0);
    detector.setMaxArea(2_147_483_647);
    detector.setPass2Only(true);

    expect(detector.getDelta()).toBe(-1);
    expect(detector.getMinArea()).toBe(0);
    expect(detector.getMaxArea()).toBe(2_147_483_647);
    expect(detector.getPass2Only()).toBe(true);
  });

  test("matches Embind integer and boolean coercion", () => {
    const detector = new MSER(new FakeMSERHandle());

    Reflect.apply(detector.setDelta, detector, [1.9]);
    expect(detector.getDelta()).toBe(1);
    Reflect.apply(detector.setDelta, detector, [-1.9]);
    expect(detector.getDelta()).toBe(-1);
    Reflect.apply(detector.setDelta, detector, [Number.NaN]);
    expect(detector.getDelta()).toBe(0);
    Reflect.apply(detector.setDelta, detector, [true]);
    expect(detector.getDelta()).toBe(1);

    for (const value of [null, undefined, "42", Number.POSITIVE_INFINITY, 2_147_483_648]) {
      expect(() => Reflect.apply(detector.setDelta, detector, [value])).toThrow(TypeError);
    }

    Reflect.apply(detector.setPass2Only, detector, ["false"]);
    expect(detector.getPass2Only()).toBe(true);
    Reflect.apply(detector.setPass2Only, detector, [Number.NaN]);
    expect(detector.getPass2Only()).toBe(false);
  });

  test("enforces method arity and explicit lifetime", () => {
    const handle = new FakeMSERHandle();
    const detector = new MSER(handle);

    expect(detector.getDelta.length).toBe(0);
    expect(detector.setDelta.length).toBe(1);
    expect(() => Reflect.apply(detector.getDelta, detector, [1])).toThrow(BindingError);
    expect(() => Reflect.apply(detector.setDelta, detector, [])).toThrow(BindingError);
    expect(() => Reflect.apply(detector.setDelta, detector, [7, 1])).toThrow(BindingError);
    expect(detector.getDelta()).toBe(5);

    expect(detector.delete.length).toBe(0);
    expect(Reflect.apply(detector.delete, detector, [1, 2])).toBeUndefined();
    expect(handle.freeCount).toBe(1);
    expect(() => detector.getDefaultName()).toThrow(
      "Cannot pass deleted object as a pointer of type MSER",
    );
    expect(() => detector.getDelta()).toThrow(
      "Cannot pass deleted object as a pointer of type MSER const*",
    );
    expect(() => detector.setDelta(7)).toThrow(
      "Cannot pass deleted object as a pointer of type MSER",
    );
    expect(() => detector.delete()).toThrow("MSER instance already deleted");
  });
});
