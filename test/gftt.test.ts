import { expect, test } from "bun:test";

import { GFTT_DETECTOR_DEFAULTS, GFTTDetector, OpenCvInputError } from "../src/index.js";
import type { WasmGFTTDetectorHandle } from "../src/index.js";

interface JavaScriptGFTTDetectorCalls {
  delete(extra?: string): void;
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
  const extraArgumentGetters = [
    () => javascriptDetector.getBlockSize("extra"),
    () => javascriptDetector.getDefaultName("extra"),
    () => javascriptDetector.getHarrisDetector("extra"),
    () => javascriptDetector.getK("extra"),
    () => javascriptDetector.getMaxFeatures("extra"),
    () => javascriptDetector.getMinDistance("extra"),
    () => javascriptDetector.getQualityLevel("extra"),
  ];
  const missingArgumentSetters = [
    () => javascriptDetector.setBlockSize(),
    () => javascriptDetector.setHarrisDetector(),
    () => javascriptDetector.setK(),
    () => javascriptDetector.setMaxFeatures(),
    () => javascriptDetector.setMinDistance(),
    () => javascriptDetector.setQualityLevel(),
  ];
  const extraArgumentSetters = [
    () => javascriptDetector.setBlockSize(8, "extra"),
    () => javascriptDetector.setHarrisDetector(true, "extra"),
    () => javascriptDetector.setK(0.08, "extra"),
    () => javascriptDetector.setMaxFeatures(2_000, "extra"),
    () => javascriptDetector.setMinDistance(2, "extra"),
    () => javascriptDetector.setQualityLevel(0.02, "extra"),
  ];

  for (const callGetter of extraArgumentGetters) {
    expect(callGetter).toThrow(OpenCvInputError);
  }
  for (const callSetter of [...missingArgumentSetters, ...extraArgumentSetters]) {
    expect(callSetter).toThrow(OpenCvInputError);
  }
  expect(detector.getBlockSize()).toBe(GFTT_DETECTOR_DEFAULTS.blockSize);
  expect(detector.getHarrisDetector()).toBe(GFTT_DETECTOR_DEFAULTS.useHarrisDetector);
  expect(detector.getK()).toBe(GFTT_DETECTOR_DEFAULTS.k);
  expect(detector.getMaxFeatures()).toBe(GFTT_DETECTOR_DEFAULTS.maxFeatures);
  expect(detector.getMinDistance()).toBe(GFTT_DETECTOR_DEFAULTS.minDistance);
  expect(detector.getQualityLevel()).toBe(GFTT_DETECTOR_DEFAULTS.qualityLevel);
});

test("GFTTDetector supports OpenCV.js delete semantics and package disposal", () => {
  const deletedHandle = new MemoryGFTTDetectorHandle();
  const deleted = new GFTTDetector(deletedHandle);

  expect(deleted.delete.bind(deleted)).toHaveLength(0);
  // SAFETY: The wider signature verifies that OpenCV.js rejects extra delete arguments.
  const javascriptDeleted = deleted as GFTTDetector & JavaScriptGFTTDetectorCalls;
  expect(() => javascriptDeleted.delete("extra")).toThrow(OpenCvInputError);
  expect(deletedHandle.freeCount).toBe(0);
  expect(deleted.delete()).toBeUndefined();
  expect(deletedHandle.freeCount).toBe(1);
  expect(() => deleted.getBlockSize()).toThrow(OpenCvInputError);
  expect(() => deleted.setBlockSize(5)).toThrow(OpenCvInputError);
  expect(() => deleted.delete()).toThrow(OpenCvInputError);
  deleted.dispose();
  expect(deletedHandle.freeCount).toBe(1);

  const disposedHandle = new MemoryGFTTDetectorHandle();
  const disposed = new GFTTDetector(disposedHandle);
  expect(disposed.dispose()).toBeUndefined();
  expect(disposed.dispose()).toBeUndefined();
  expect(disposedHandle.freeCount).toBe(1);
  expect(() => disposed.delete()).toThrow(OpenCvInputError);
});
