import { expect, test } from "bun:test";

import { GFTT_DETECTOR_DEFAULTS, GFTTDetector } from "../src/index.js";
import type { WasmGFTTDetectorHandle } from "../src/index.js";

class MemoryGFTTDetectorHandle implements WasmGFTTDetectorHandle {
  constructor(
    private maxFeatures = GFTT_DETECTOR_DEFAULTS.maxFeatures,
    private qualityLevel = GFTT_DETECTOR_DEFAULTS.qualityLevel,
    private minDistance = GFTT_DETECTOR_DEFAULTS.minDistance,
    private blockSize = GFTT_DETECTOR_DEFAULTS.blockSize,
    private harrisDetector = GFTT_DETECTOR_DEFAULTS.useHarrisDetector,
    private k = GFTT_DETECTOR_DEFAULTS.k,
  ) {}

  free(): void {}

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
