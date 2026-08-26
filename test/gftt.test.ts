import { expect, test } from "bun:test";

import { BindingError, GFTT_DETECTOR_DEFAULTS, GFTTDetector } from "../src/index.js";
import type { WasmGFTTDetectorHandle } from "../src/index.js";

interface JavaScriptGFTTDetectorCalls {
  delete(first?: number, second?: number): void;
  getBlockSize(extra?: string): number;
  getDefaultName(extra?: string): string;
  getHarrisDetector(extra?: string): boolean;
  getK(extra?: string): number;
  getMaxFeatures(extra?: string): number;
  getMinDistance(extra?: string): number;
  getQualityLevel(extra?: string): number;
  setBlockSize(value?: number, extra?: string): void;
  setHarrisDetector(value?: boolean, extra?: string): void;
  setK(value?: number, extra?: string): void;
  setMaxFeatures(value?: number, extra?: string): void;
  setMinDistance(value?: number, extra?: string): void;
  setQualityLevel(value?: number, extra?: string): void;
}

class MemoryGFTTDetectorHandle implements WasmGFTTDetectorHandle {
  freeCount = 0;

  constructor(
    private maxFeatures = GFTT_DETECTOR_DEFAULTS.maxFeatures,
    private qualityLevel = GFTT_DETECTOR_DEFAULTS.qualityLevel,
    private minDistance = GFTT_DETECTOR_DEFAULTS.minDistance,
    private blockSize = GFTT_DETECTOR_DEFAULTS.blockSize,
    private harrisDetector = GFTT_DETECTOR_DEFAULTS.useHarrisDetector,
    private k = GFTT_DETECTOR_DEFAULTS.k,
  ) {}

  free(): void {
    this.freeCount += 1;
  }

  getBlockSize(): number {
    return this.blockSize;
  }

  getDefaultName(): string {
    return "Feature2D.GFTTDetector";
  }

  getHarrisDetector(): boolean {
    return this.harrisDetector;
  }

  getK(): number {
    return this.k;
  }

  getMaxFeatures(): number {
    return this.maxFeatures;
  }

  getMinDistance(): number {
    return this.minDistance;
  }

  getQualityLevel(): number {
    return this.qualityLevel;
  }

  setBlockSize(value: number): void {
    this.blockSize = value;
  }

  setHarrisDetector(value: boolean): void {
    this.harrisDetector = value;
  }

  setK(value: number): void {
    this.k = value;
  }

  setMaxFeatures(value: number): void {
    this.maxFeatures = value;
  }

  setMinDistance(value: number): void {
    this.minDistance = value;
  }

  setQualityLevel(value: number): void {
    this.qualityLevel = value;
  }
}

test("BindingError matches the OpenCV.js error identity", () => {
  const error = new BindingError("pinned message");

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(BindingError);
  expect(error.constructor).toBe(BindingError);
  expect(error.name).toBe("BindingError");
  expect(error.message).toBe("pinned message");
});

test("GFTTDetector exposes OpenCV 4.13 configuration defaults", () => {
  const detector = new GFTTDetector(new MemoryGFTTDetectorHandle());

  expect(detector.getDefaultName()).toBe("Feature2D.GFTTDetector");
  expect(detector.getMaxFeatures()).toBe(1_000);
  expect(detector.getQualityLevel()).toBe(0.01);
  expect(detector.getMinDistance()).toBe(1);
  expect(detector.getBlockSize()).toBe(3);
  expect(detector.getHarrisDetector()).toBe(false);
  expect(detector.getK()).toBe(0.04);
});

test("GFTTDetector integer setters use WebAssembly i32 coercion", () => {
  const detector = new GFTTDetector(new MemoryGFTTDetectorHandle());

  expect(detector.setBlockSize(7.9)).toBeUndefined();
  expect(detector.getBlockSize()).toBe(7);
  detector.setBlockSize(-7.9);
  expect(detector.getBlockSize()).toBe(-7);
  detector.setBlockSize(Number.NaN);
  expect(detector.getBlockSize()).toBe(0);
  detector.setBlockSize(Number.POSITIVE_INFINITY);
  expect(detector.getBlockSize()).toBe(0);
  detector.setMaxFeatures(4_294_967_301);
  expect(detector.getMaxFeatures()).toBe(5);
  detector.setMaxFeatures(2_147_483_648);
  expect(detector.getMaxFeatures()).toBe(-2_147_483_648);

  // SAFETY: This deliberately models an untyped JavaScript call while the exported method stays strict.
  const javascriptDetector = detector as GFTTDetector & {
    setBlockSize(value: number | undefined): void;
  };
  javascriptDetector.setBlockSize(undefined);
  expect(detector.getBlockSize()).toBe(0);
});

test("GFTTDetector boolean setter follows the WebAssembly public conversion", () => {
  const detector = new GFTTDetector(new MemoryGFTTDetectorHandle());

  // SAFETY: Numeric booleans are accepted by the OpenCV.js runtime but excluded from typed calls.
  const javascriptDetector = detector as GFTTDetector & {
    setHarrisDetector(value: boolean | 0 | 1): void;
  };
  expect(javascriptDetector.setHarrisDetector(0)).toBeUndefined();
  expect(detector.getHarrisDetector()).toBe(false);
  expect(javascriptDetector.setHarrisDetector(1)).toBeUndefined();
  expect(detector.getHarrisDetector()).toBe(true);
});

test("GFTTDetector floating-point setters preserve IEEE-754 values", () => {
  const detector = new GFTTDetector(new MemoryGFTTDetectorHandle());

  expect(detector.setK(Number.NaN)).toBeUndefined();
  expect(detector.getK()).toBeNaN();
  expect(detector.setMinDistance(Number.NEGATIVE_INFINITY)).toBeUndefined();
  expect(detector.getMinDistance()).toBe(Number.NEGATIVE_INFINITY);
  expect(detector.setQualityLevel(Number.POSITIVE_INFINITY)).toBeUndefined();
  expect(detector.getQualityLevel()).toBe(Number.POSITIVE_INFINITY);
});

test("GFTTDetector methods enforce OpenCV.js arity", () => {
  const detector = new GFTTDetector(new MemoryGFTTDetectorHandle());

  expect(detector.getBlockSize.bind(detector)).toHaveLength(0);
  expect(detector.getDefaultName.bind(detector)).toHaveLength(0);
  expect(detector.getHarrisDetector.bind(detector)).toHaveLength(0);
  expect(detector.getK.bind(detector)).toHaveLength(0);
  expect(detector.getMaxFeatures.bind(detector)).toHaveLength(0);
  expect(detector.getMinDistance.bind(detector)).toHaveLength(0);
  expect(detector.getQualityLevel.bind(detector)).toHaveLength(0);
  expect(detector.setBlockSize.bind(detector)).toHaveLength(1);
  expect(detector.setHarrisDetector.bind(detector)).toHaveLength(1);
  expect(detector.setK.bind(detector)).toHaveLength(1);
  expect(detector.setMaxFeatures.bind(detector)).toHaveLength(1);
  expect(detector.setMinDistance.bind(detector)).toHaveLength(1);
  expect(detector.setQualityLevel.bind(detector)).toHaveLength(1);

  // SAFETY: Wider call signatures model JavaScript arity errors without weakening the public types.
  const javascriptDetector = detector as GFTTDetector & JavaScriptGFTTDetectorCalls;
  const wrongArityCalls: ReadonlyArray<readonly [() => void, string]> = [
    [
      () => javascriptDetector.getBlockSize("extra"),
      "function GFTTDetector.getBlockSize called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptDetector.getDefaultName("extra"),
      "function GFTTDetector.getDefaultName called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptDetector.getHarrisDetector("extra"),
      "function GFTTDetector.getHarrisDetector called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptDetector.getK("extra"),
      "function GFTTDetector.getK called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptDetector.getMaxFeatures("extra"),
      "function GFTTDetector.getMaxFeatures called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptDetector.getMinDistance("extra"),
      "function GFTTDetector.getMinDistance called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptDetector.getQualityLevel("extra"),
      "function GFTTDetector.getQualityLevel called with 1 arguments, expected 0 args!",
    ],
    [
      () => javascriptDetector.setBlockSize(),
      "function GFTTDetector.setBlockSize called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptDetector.setHarrisDetector(),
      "function GFTTDetector.setHarrisDetector called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptDetector.setK(),
      "function GFTTDetector.setK called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptDetector.setMaxFeatures(),
      "function GFTTDetector.setMaxFeatures called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptDetector.setMinDistance(),
      "function GFTTDetector.setMinDistance called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptDetector.setQualityLevel(),
      "function GFTTDetector.setQualityLevel called with 0 arguments, expected 1 args!",
    ],
    [
      () => javascriptDetector.setBlockSize(8, "extra"),
      "function GFTTDetector.setBlockSize called with 2 arguments, expected 1 args!",
    ],
    [
      () => javascriptDetector.setHarrisDetector(true, "extra"),
      "function GFTTDetector.setHarrisDetector called with 2 arguments, expected 1 args!",
    ],
    [
      () => javascriptDetector.setK(0.08, "extra"),
      "function GFTTDetector.setK called with 2 arguments, expected 1 args!",
    ],
    [
      () => javascriptDetector.setMaxFeatures(2_000, "extra"),
      "function GFTTDetector.setMaxFeatures called with 2 arguments, expected 1 args!",
    ],
    [
      () => javascriptDetector.setMinDistance(2, "extra"),
      "function GFTTDetector.setMinDistance called with 2 arguments, expected 1 args!",
    ],
    [
      () => javascriptDetector.setQualityLevel(0.02, "extra"),
      "function GFTTDetector.setQualityLevel called with 2 arguments, expected 1 args!",
    ],
  ];

  for (const [call, message] of wrongArityCalls) {
    expect(call).toThrow(new BindingError(message));
  }
  expect(detector.getBlockSize()).toBe(GFTT_DETECTOR_DEFAULTS.blockSize);
  expect(detector.getHarrisDetector()).toBe(GFTT_DETECTOR_DEFAULTS.useHarrisDetector);
  expect(detector.getK()).toBe(GFTT_DETECTOR_DEFAULTS.k);
  expect(detector.getMaxFeatures()).toBe(GFTT_DETECTOR_DEFAULTS.maxFeatures);
  expect(detector.getMinDistance()).toBe(GFTT_DETECTOR_DEFAULTS.minDistance);
  expect(detector.getQualityLevel()).toBe(GFTT_DETECTOR_DEFAULTS.qualityLevel);
});

test("GFTTDetector supports OpenCV.js delete semantics and package disposal", () => {
  const oneArgumentHandle = new MemoryGFTTDetectorHandle();
  const oneArgumentDelete = new GFTTDetector(oneArgumentHandle);
  // SAFETY: OpenCV.js accepts extra delete arguments even though the typed method accepts none.
  const javascriptOneArgumentDelete = oneArgumentDelete as GFTTDetector &
    JavaScriptGFTTDetectorCalls;
  expect(javascriptOneArgumentDelete.delete(1)).toBeUndefined();
  expect(oneArgumentHandle.freeCount).toBe(1);

  const twoArgumentHandle = new MemoryGFTTDetectorHandle();
  const twoArgumentDelete = new GFTTDetector(twoArgumentHandle);
  // SAFETY: OpenCV.js accepts extra delete arguments even though the typed method accepts none.
  const javascriptTwoArgumentDelete = twoArgumentDelete as GFTTDetector &
    JavaScriptGFTTDetectorCalls;
  expect(javascriptTwoArgumentDelete.delete(1, 2)).toBeUndefined();
  expect(twoArgumentHandle.freeCount).toBe(1);

  const deletedHandle = new MemoryGFTTDetectorHandle();
  const deleted = new GFTTDetector(deletedHandle);

  expect(deleted.delete.bind(deleted)).toHaveLength(0);
  expect(deleted.delete()).toBeUndefined();
  expect(deletedHandle.freeCount).toBe(1);
  const postDeleteConstGetters = [
    () => deleted.getBlockSize(),
    () => deleted.getHarrisDetector(),
    () => deleted.getK(),
    () => deleted.getMaxFeatures(),
    () => deleted.getMinDistance(),
    () => deleted.getQualityLevel(),
  ];
  for (const callGetter of postDeleteConstGetters) {
    expect(callGetter).toThrow(
      new BindingError("Cannot pass deleted object as a pointer of type GFTTDetector const*"),
    );
  }
  expect(() => deleted.getDefaultName()).toThrow(
    new BindingError("Cannot pass deleted object as a pointer of type GFTTDetector"),
  );
  const postDeleteSetters = [
    () => deleted.setBlockSize(5),
    () => deleted.setHarrisDetector(true),
    () => deleted.setK(0.05),
    () => deleted.setMaxFeatures(2_000),
    () => deleted.setMinDistance(2),
    () => deleted.setQualityLevel(0.02),
  ];
  for (const callSetter of postDeleteSetters) {
    expect(callSetter).toThrow(
      new BindingError("Cannot pass deleted object as a pointer of type GFTTDetector"),
    );
  }
  expect(() => deleted.delete()).toThrow(new BindingError("GFTTDetector instance already deleted"));
  deleted.dispose();
  expect(deletedHandle.freeCount).toBe(1);

  const disposedHandle = new MemoryGFTTDetectorHandle();
  const disposed = new GFTTDetector(disposedHandle);
  expect(disposed.dispose()).toBeUndefined();
  expect(disposed.dispose()).toBeUndefined();
  expect(disposedHandle.freeCount).toBe(1);
  expect(() => disposed.delete()).toThrow(
    new BindingError("GFTTDetector instance already deleted"),
  );
});
