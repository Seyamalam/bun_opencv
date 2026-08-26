import { expect, test } from "bun:test";

import { BindingError, KAZE, KAZE_DEFAULTS } from "../src/index.js";
import type { WasmKAZEHandle } from "../src/index.js";

interface JavaScriptObjectScalar {
  toString(): string;
}

type JavaScriptScalar = boolean | number | JavaScriptObjectScalar | string | null | undefined;

interface JavaScriptKAZECalls {
  delete(first?: number, second?: number): void;
  getDefaultName(extra?: string): string;
  getExtended(extra?: string): boolean;
  getNOctaveLayers(extra?: string): number;
  getNOctaves(extra?: string): number;
  getThreshold(extra?: string): number;
  getUpright(extra?: string): boolean;
  setExtended(value?: JavaScriptScalar, extra?: string): void;
  setNOctaveLayers(value?: JavaScriptScalar, extra?: string): void;
  setNOctaves(value?: JavaScriptScalar, extra?: string): void;
  setThreshold(value?: JavaScriptScalar, extra?: string): void;
  setUpright(value?: JavaScriptScalar, extra?: string): void;
}

class MemoryKAZEHandle implements WasmKAZEHandle {
  freeCount = 0;
  diffusivity = KAZE_DEFAULTS.diffusivity;
  extended = KAZE_DEFAULTS.extended;
  octaveLayers = KAZE_DEFAULTS.octaveLayers;
  octaves = KAZE_DEFAULTS.octaves;
  threshold = KAZE_DEFAULTS.threshold;
  upright = KAZE_DEFAULTS.upright;

  free(): void {
    this.freeCount += 1;
  }
  getDefaultName(): string {
    return "Feature2D.KAZE";
  }
  getDiffusivity(): number {
    return this.diffusivity;
  }
  getExtended(): boolean {
    return this.extended;
  }
  getNOctaveLayers(): number {
    return this.octaveLayers;
  }
  getNOctaves(): number {
    return this.octaves;
  }
  getThreshold(): number {
    return this.threshold;
  }
  getUpright(): boolean {
    return this.upright;
  }
  setDiffusivity(value: number): void {
    this.diffusivity = value;
  }
  setExtended(value: boolean): void {
    this.extended = value;
  }
  setNOctaveLayers(value: number): void {
    this.octaveLayers = value;
  }
  setNOctaves(value: number): void {
    this.octaves = value;
  }
  setThreshold(value: number): void {
    this.threshold = value;
  }
  setUpright(value: boolean): void {
    this.upright = value;
  }
}

test("KAZE non-enum methods expose exact OpenCV.js arity", () => {
  const kaze = new KAZE(new MemoryKAZEHandle());
  const getters = [
    kaze.getDefaultName.bind(kaze),
    kaze.getExtended.bind(kaze),
    kaze.getNOctaveLayers.bind(kaze),
    kaze.getNOctaves.bind(kaze),
    kaze.getThreshold.bind(kaze),
    kaze.getUpright.bind(kaze),
  ];
  const setters = [
    kaze.setExtended.bind(kaze),
    kaze.setNOctaveLayers.bind(kaze),
    kaze.setNOctaves.bind(kaze),
    kaze.setThreshold.bind(kaze),
    kaze.setUpright.bind(kaze),
  ];
  for (const getter of getters) expect(getter).toHaveLength(0);
  for (const setter of setters) expect(setter).toHaveLength(1);

  // SAFETY: The widened signatures exercise plain-JavaScript calls against the typed public seam.
  const javascriptKaze = kaze as KAZE & JavaScriptKAZECalls;
  const wrongCalls: ReadonlyArray<readonly [() => void, string]> = [
    [
      () => javascriptKaze.getDefaultName("x"),
      "function KAZE.getDefaultName called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptKaze.getExtended("x"),
      "function KAZE.getExtended called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptKaze.getNOctaveLayers("x"),
      "function KAZE.getNOctaveLayers called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptKaze.getNOctaves("x"),
      "function KAZE.getNOctaves called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptKaze.getThreshold("x"),
      "function KAZE.getThreshold called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptKaze.getUpright("x"),
      "function KAZE.getUpright called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptKaze.setExtended(),
      "function KAZE.setExtended called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptKaze.setNOctaveLayers(),
      "function KAZE.setNOctaveLayers called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptKaze.setNOctaves(),
      "function KAZE.setNOctaves called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptKaze.setThreshold(),
      "function KAZE.setThreshold called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptKaze.setUpright(),
      "function KAZE.setUpright called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptKaze.setExtended(true, "x"),
      "function KAZE.setExtended called with 2 arguments, expected 1 args!",
    ],
    [
      () => javascriptKaze.setNOctaveLayers(4, "x"),
      "function KAZE.setNOctaveLayers called with 2 arguments, expected 1 args!",
    ],
    [
      () => javascriptKaze.setNOctaves(4, "x"),
      "function KAZE.setNOctaves called with 2 arguments, expected 1 args!",
    ],
    [
      () => javascriptKaze.setThreshold(0.1, "x"),
      "function KAZE.setThreshold called with 2 arguments, expected 1 args!",
    ],
    [
      () => javascriptKaze.setUpright(true, "x"),
      "function KAZE.setUpright called with 2 arguments, expected 1 args!",
    ],
  ];
  for (const [call, message] of wrongCalls) expect(call).toThrow(new BindingError(message));
});

test("KAZE setters reproduce Embind primitive conversion", () => {
  const handle = new MemoryKAZEHandle();
  const kaze = new KAZE(handle);
  // SAFETY: The widened signatures exercise Embind conversion at the plain-JavaScript boundary.
  const javascriptKaze = kaze as KAZE & JavaScriptKAZECalls;

  javascriptKaze.setNOctaves(7.9);
  expect(kaze.getNOctaves()).toBe(7);
  javascriptKaze.setNOctaveLayers(Number.NaN);
  expect(kaze.getNOctaveLayers()).toBe(0);
  javascriptKaze.setNOctaves(true);
  expect(kaze.getNOctaves()).toBe(1);
  expect(() => javascriptKaze.setNOctaves(null)).toThrow(
    new TypeError('Cannot convert "null" to int'),
  );
  expect(() => javascriptKaze.setNOctaves(Number.POSITIVE_INFINITY)).toThrow(
    new TypeError(
      'Passing a number "Infinity" from JS side to C/C++ side to an argument of type "int", which is outside the valid range [-2147483648, 2147483647]!',
    ),
  );

  javascriptKaze.setThreshold(-0);
  expect(Object.is(kaze.getThreshold(), -0)).toBe(true);
  javascriptKaze.setThreshold(Number.NaN);
  expect(kaze.getThreshold()).toBeNaN();
  javascriptKaze.setThreshold(Number.POSITIVE_INFINITY);
  expect(kaze.getThreshold()).toBe(Number.POSITIVE_INFINITY);
  javascriptKaze.setThreshold(false);
  expect(kaze.getThreshold()).toBe(0);
  expect(() => javascriptKaze.setThreshold("1")).toThrow(
    new TypeError('Cannot convert "1" to double'),
  );

  javascriptKaze.setExtended(0);
  expect(kaze.getExtended()).toBe(false);
  javascriptKaze.setExtended({});
  expect(kaze.getExtended()).toBe(true);
  javascriptKaze.setUpright("");
  expect(kaze.getUpright()).toBe(false);
});

test("KAZE delete and post-delete behavior matches OpenCV.js", () => {
  const handle = new MemoryKAZEHandle();
  const kaze = new KAZE(handle);
  // SAFETY: The widened signature verifies OpenCV.js accepts ignored delete arguments.
  const javascriptKaze = kaze as KAZE & JavaScriptKAZECalls;
  expect(javascriptKaze.delete(1, 2)).toBeUndefined();
  expect(handle.freeCount).toBe(1);

  for (const getter of [
    () => kaze.getExtended(),
    () => kaze.getNOctaveLayers(),
    () => kaze.getNOctaves(),
    () => kaze.getThreshold(),
    () => kaze.getUpright(),
  ]) {
    expect(getter).toThrow(
      new BindingError("Cannot pass deleted object as a pointer of type KAZE const*"),
    );
  }
  expect(() => kaze.getDefaultName()).toThrow(
    new BindingError("Cannot pass deleted object as a pointer of type KAZE"),
  );
  for (const setter of [
    () => kaze.setExtended(true),
    () => kaze.setNOctaveLayers(4),
    () => kaze.setNOctaves(4),
    () => kaze.setThreshold(0.1),
    () => kaze.setUpright(true),
  ]) {
    expect(setter).toThrow(
      new BindingError("Cannot pass deleted object as a pointer of type KAZE"),
    );
  }
  expect(() => kaze.delete()).toThrow(new BindingError("KAZE instance already deleted"));
  kaze.dispose();
  expect(handle.freeCount).toBe(1);
});
