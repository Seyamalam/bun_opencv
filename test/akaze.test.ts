import { expect, test } from "bun:test";

import { AKAZE, AKAZE_DEFAULTS, BindingError } from "../src/index.js";
import type { WasmAKAZEHandle } from "../src/index.js";

interface JavaScriptObjectScalar {
  toString(): string;
}

type JavaScriptScalar = boolean | number | JavaScriptObjectScalar | string | null | undefined;

interface JavaScriptAKAZECalls {
  delete(first?: number, second?: number): void;
  getDefaultName(extra?: string): string;
  getDescriptorChannels(extra?: string): number;
  getDescriptorSize(extra?: string): number;
  getNOctaveLayers(extra?: string): number;
  getNOctaves(extra?: string): number;
  getThreshold(extra?: string): number;
  setDescriptorChannels(value?: JavaScriptScalar, extra?: string): void;
  setDescriptorSize(value?: JavaScriptScalar, extra?: string): void;
  setNOctaveLayers(value?: JavaScriptScalar, extra?: string): void;
  setNOctaves(value?: JavaScriptScalar, extra?: string): void;
  setThreshold(value?: JavaScriptScalar, extra?: string): void;
}

class MemoryAKAZEHandle implements WasmAKAZEHandle {
  freeCount = 0;
  descriptorChannels: number = AKAZE_DEFAULTS.descriptorChannels;
  descriptorSize = AKAZE_DEFAULTS.descriptorSize;
  descriptorType = AKAZE_DEFAULTS.descriptorType;
  diffusivity = AKAZE_DEFAULTS.diffusivity;
  octaveLayers = AKAZE_DEFAULTS.octaveLayers;
  octaves = AKAZE_DEFAULTS.octaves;
  threshold = AKAZE_DEFAULTS.threshold;

  free(): void {
    this.freeCount += 1;
  }
  getDefaultName(): string {
    return "Feature2D.AKAZE";
  }
  getDescriptorChannels(): number {
    return this.descriptorChannels;
  }
  getDescriptorSize(): number {
    return this.descriptorSize;
  }
  getDescriptorType(): number {
    return this.descriptorType;
  }
  getDiffusivity(): number {
    return this.diffusivity;
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
  setDescriptorChannels(value: number): void {
    this.descriptorChannels = value;
  }
  setDescriptorSize(value: number): void {
    this.descriptorSize = value;
  }
  setDescriptorType(value: number): void {
    this.descriptorType = value;
  }
  setDiffusivity(value: number): void {
    this.diffusivity = value;
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
}

test("AKAZE non-enum methods enforce exact OpenCV.js arity", () => {
  const akaze = new AKAZE(new MemoryAKAZEHandle());
  for (const getter of [
    akaze.getDefaultName.bind(akaze),
    akaze.getDescriptorChannels.bind(akaze),
    akaze.getDescriptorSize.bind(akaze),
    akaze.getNOctaveLayers.bind(akaze),
    akaze.getNOctaves.bind(akaze),
    akaze.getThreshold.bind(akaze),
  ]) {
    expect(getter).toHaveLength(0);
  }
  for (const setter of [
    akaze.setDescriptorChannels.bind(akaze),
    akaze.setDescriptorSize.bind(akaze),
    akaze.setNOctaveLayers.bind(akaze),
    akaze.setNOctaves.bind(akaze),
    akaze.setThreshold.bind(akaze),
  ]) {
    expect(setter).toHaveLength(1);
  }

  // SAFETY: The widened signatures exercise plain-JavaScript calls against the typed public seam.
  const javascriptAkaze = akaze as AKAZE & JavaScriptAKAZECalls;
  const wrongCalls: ReadonlyArray<readonly [() => void, string]> = [
    [
      () => javascriptAkaze.getDefaultName("x"),
      "function AKAZE.getDefaultName called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptAkaze.getDescriptorChannels("x"),
      "function AKAZE.getDescriptorChannels called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptAkaze.getDescriptorSize("x"),
      "function AKAZE.getDescriptorSize called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptAkaze.getNOctaveLayers("x"),
      "function AKAZE.getNOctaveLayers called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptAkaze.getNOctaves("x"),
      "function AKAZE.getNOctaves called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptAkaze.getThreshold("x"),
      "function AKAZE.getThreshold called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptAkaze.setDescriptorChannels(),
      "function AKAZE.setDescriptorChannels called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptAkaze.setDescriptorSize(),
      "function AKAZE.setDescriptorSize called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptAkaze.setNOctaveLayers(),
      "function AKAZE.setNOctaveLayers called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptAkaze.setNOctaves(),
      "function AKAZE.setNOctaves called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptAkaze.setThreshold(),
      "function AKAZE.setThreshold called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptAkaze.setDescriptorChannels(2, "x"),
      "function AKAZE.setDescriptorChannels called with 2 arguments, expected 1 args!",
    ],
    [
      () => javascriptAkaze.setDescriptorSize(96, "x"),
      "function AKAZE.setDescriptorSize called with 2 arguments, expected 1 args!",
    ],
    [
      () => javascriptAkaze.setNOctaveLayers(6, "x"),
      "function AKAZE.setNOctaveLayers called with 2 arguments, expected 1 args!",
    ],
    [
      () => javascriptAkaze.setNOctaves(5, "x"),
      "function AKAZE.setNOctaves called with 2 arguments, expected 1 args!",
    ],
    [
      () => javascriptAkaze.setThreshold(0.25, "x"),
      "function AKAZE.setThreshold called with 2 arguments, expected 1 args!",
    ],
  ];
  for (const [call, message] of wrongCalls) expect(call).toThrow(new BindingError(message));
});

test("AKAZE non-enum setters reproduce Embind conversion and raw state", () => {
  const akaze = new AKAZE(new MemoryAKAZEHandle());
  // SAFETY: The widened signatures exercise Embind conversion at the plain-JavaScript boundary.
  const javascriptAkaze = akaze as AKAZE & JavaScriptAKAZECalls;
  const integerSetters = [
    [
      javascriptAkaze.setDescriptorChannels.bind(javascriptAkaze),
      akaze.getDescriptorChannels.bind(akaze),
    ],
    [javascriptAkaze.setDescriptorSize.bind(javascriptAkaze), akaze.getDescriptorSize.bind(akaze)],
    [javascriptAkaze.setNOctaveLayers.bind(javascriptAkaze), akaze.getNOctaveLayers.bind(akaze)],
    [javascriptAkaze.setNOctaves.bind(javascriptAkaze), akaze.getNOctaves.bind(akaze)],
  ] as const;
  for (const [setter, getter] of integerSetters) {
    expect(setter(1.9)).toBeUndefined();
    expect(getter()).toBe(1);
    setter(-1.9);
    expect(getter()).toBe(-1);
    setter(Number.NaN);
    expect(getter()).toBe(0);
    setter(true);
    expect(getter()).toBe(1);
    expect(() => setter(null)).toThrow(new TypeError('Cannot convert "null" to int'));
    expect(() => setter(Number.POSITIVE_INFINITY)).toThrow(
      new TypeError(
        'Passing a number "Infinity" from JS side to C/C++ side to an argument of type "int", which is outside the valid range [-2147483648, 2147483647]!',
      ),
    );
  }

  javascriptAkaze.setThreshold(-0);
  expect(Object.is(akaze.getThreshold(), -0)).toBe(true);
  javascriptAkaze.setThreshold(Number.NaN);
  expect(akaze.getThreshold()).toBeNaN();
  javascriptAkaze.setThreshold(Number.NEGATIVE_INFINITY);
  expect(akaze.getThreshold()).toBe(Number.NEGATIVE_INFINITY);
  javascriptAkaze.setThreshold(false);
  expect(akaze.getThreshold()).toBe(0);
  expect(() => javascriptAkaze.setThreshold("1")).toThrow(
    new TypeError('Cannot convert "1" to double'),
  );
});

test("AKAZE delete and post-delete behavior matches OpenCV.js", () => {
  const handle = new MemoryAKAZEHandle();
  const akaze = new AKAZE(handle);
  // SAFETY: The widened signature verifies OpenCV.js accepts ignored delete arguments.
  const javascriptAkaze = akaze as AKAZE & JavaScriptAKAZECalls;
  expect(javascriptAkaze.delete(1, 2)).toBeUndefined();
  expect(handle.freeCount).toBe(1);

  for (const getter of [
    () => akaze.getDescriptorChannels(),
    () => akaze.getDescriptorSize(),
    () => akaze.getNOctaveLayers(),
    () => akaze.getNOctaves(),
    () => akaze.getThreshold(),
  ]) {
    expect(getter).toThrow(
      new BindingError("Cannot pass deleted object as a pointer of type AKAZE const*"),
    );
  }
  expect(() => akaze.getDefaultName()).toThrow(
    new BindingError("Cannot pass deleted object as a pointer of type AKAZE"),
  );
  for (const setter of [
    () => akaze.setDescriptorChannels(2),
    () => akaze.setDescriptorSize(96),
    () => akaze.setNOctaveLayers(6),
    () => akaze.setNOctaves(5),
    () => akaze.setThreshold(0.25),
  ]) {
    expect(setter).toThrow(
      new BindingError("Cannot pass deleted object as a pointer of type AKAZE"),
    );
  }
  expect(() => akaze.delete()).toThrow(new BindingError("AKAZE instance already deleted"));
  akaze.dispose();
  expect(handle.freeCount).toBe(1);
});
