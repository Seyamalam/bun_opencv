import { describe, expect, test } from "bun:test";

import {
  AGAST_FEATURE_DETECTOR_DEFAULTS,
  AgastFeatureDetector_DetectorType,
  AKAZE_DEFAULTS,
  AKAZE_DescriptorType,
  AKAZEDescriptorType,
  BindingError,
  createOpenCv,
  createRgbaImage,
  FAST_FEATURE_DETECTOR_DEFAULTS,
  FastFeatureDetector_DetectorType,
  GFTT_DETECTOR_DEFAULTS,
  KAZE_DEFAULTS,
  KAZE_DiffusivityType,
  KAZEDiffusivity,
  OpenCvInputError,
} from "../src/index.js";
import type {
  Mat,
  OpenCvBackend,
  WasmAgastFeatureDetectorFactory,
  WasmAgastFeatureDetectorHandle,
  WasmAKAZEFactory,
  WasmAKAZEHandle,
  WasmFastFeatureDetectorFactory,
  WasmFastFeatureDetectorHandle,
  WasmGFTTDetectorFactory,
  WasmGFTTDetectorHandle,
  WasmKAZEFactory,
  WasmKAZEHandle,
  WasmMatHandle,
} from "../src/index.js";

class CopyingMatHandle implements WasmMatHandle {
  readonly byteLength: number;
  readonly isContinuous: boolean;
  readonly rowStride: number;

  constructor(
    readonly rows: number,
    readonly columns: number,
    readonly channels: number,
    readonly data: Uint8Array,
    readonly depth = 0,
  ) {
    const byteWidth = depthByteWidth(depth);
    this.byteLength = rows * columns * channels * byteWidth;
    this.isContinuous = rows > 0 && columns > 0;
    this.rowStride = columns * channels * byteWidth;
  }

  free(): void {}

  copyFromBytes(data: Uint8Array): void {
    if (data.byteLength !== this.byteLength) {
      throw new OpenCvInputError("matrix buffer length mismatch");
    }
    this.data.set(data);
  }

  roi(row: number, column: number, rows: number, columns: number): WasmMatHandle {
    const byteWidth = depthByteWidth(this.depth);
    const output = new Uint8Array(rows * columns * this.channels * byteWidth);
    for (let targetRow = 0; targetRow < rows; targetRow += 1) {
      const sourceStart = (row + targetRow) * this.rowStride + column * this.channels * byteWidth;
      const sourceEnd = sourceStart + columns * this.channels * byteWidth;
      const targetStart = targetRow * columns * this.channels * byteWidth;
      output.set(this.data.subarray(sourceStart, sourceEnd), targetStart);
    }
    return new CopyingMatHandle(rows, columns, this.channels, output, this.depth);
  }

  toFloat32Array(): Float32Array {
    return new Float32Array(this.data.slice().buffer);
  }

  toFloat64Array(): Float64Array {
    return new Float64Array(this.data.slice().buffer);
  }

  toInt16Array(): Int16Array {
    return new Int16Array(this.data.slice().buffer);
  }

  toInt32Array(): Int32Array {
    return new Int32Array(this.data.slice().buffer);
  }

  toInt8Array(): Int8Array {
    return new Int8Array(this.data.slice().buffer);
  }

  toUint16Array(): Uint16Array {
    return new Uint16Array(this.data.slice().buffer);
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.data);
  }
}

class CopyingAKAZEHandle implements WasmAKAZEHandle {
  #descriptorChannels: number;
  #descriptorSize: number;
  #descriptorType: number;
  #diffusivity: number;
  #freed = false;
  #octaveLayers: number;
  #octaves: number;
  #threshold: number;

  constructor(
    descriptorType: number,
    descriptorSize: number,
    descriptorChannels: number,
    threshold: number,
    octaves: number,
    octaveLayers: number,
    diffusivity: number,
    readonly onFree: () => void,
  ) {
    this.#descriptorType = descriptorType;
    this.#descriptorSize = descriptorSize;
    this.#descriptorChannels = descriptorChannels;
    this.#threshold = threshold;
    this.#octaves = octaves;
    this.#octaveLayers = octaveLayers;
    this.#diffusivity = diffusivity;
  }

  free(): void {
    if (this.#freed) return;
    this.#freed = true;
    this.onFree();
  }

  getDefaultName(): string {
    return "Feature2D.AKAZE";
  }

  getDescriptorChannels(): number {
    return this.#descriptorChannels;
  }

  getDescriptorSize(): number {
    return this.#descriptorSize;
  }

  getDescriptorType(): number {
    return this.#descriptorType;
  }

  getDiffusivity(): number {
    return this.#diffusivity;
  }

  getNOctaveLayers(): number {
    return this.#octaveLayers;
  }

  getNOctaves(): number {
    return this.#octaves;
  }

  getThreshold(): number {
    return this.#threshold;
  }

  setDescriptorChannels(value: number): void {
    this.#descriptorChannels = value;
  }

  setDescriptorSize(value: number): void {
    this.#descriptorSize = value;
  }

  setDescriptorType(value: number): void {
    if (!Number.isInteger(value) || value < 2 || value > 5) {
      throw new OpenCvInputError("invalid AKAZE descriptor type");
    }
    this.#descriptorType = value;
  }

  setDiffusivity(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 3) {
      throw new OpenCvInputError("invalid AKAZE diffusivity");
    }
    this.#diffusivity = value;
  }

  setNOctaveLayers(value: number): void {
    this.#octaveLayers = value;
  }

  setNOctaves(value: number): void {
    this.#octaves = value;
  }

  setThreshold(value: number): void {
    this.#threshold = value;
  }
}

class CopyingGFTTDetectorHandle implements WasmGFTTDetectorHandle {
  #blockSize: number;
  #freed = false;
  #harrisDetector: boolean;
  #k: number;
  #maxFeatures: number;
  #minDistance: number;
  #qualityLevel: number;

  constructor(
    maxFeatures: number,
    qualityLevel: number,
    minDistance: number,
    blockSize: number,
    harrisDetector: boolean,
    k: number,
    readonly onFree: () => void,
  ) {
    this.#maxFeatures = maxFeatures;
    this.#qualityLevel = qualityLevel;
    this.#minDistance = minDistance;
    this.#blockSize = blockSize;
    this.#harrisDetector = harrisDetector;
    this.#k = k;
  }

  free(): void {
    if (this.#freed) return;
    this.#freed = true;
    this.onFree();
  }

  getBlockSize(): number {
    return this.#blockSize;
  }

  getDefaultName(): string {
    return "Feature2D.GFTTDetector";
  }

  getHarrisDetector(): boolean {
    return this.#harrisDetector;
  }

  getK(): number {
    return this.#k;
  }

  getMaxFeatures(): number {
    return this.#maxFeatures;
  }

  getMinDistance(): number {
    return this.#minDistance;
  }

  getQualityLevel(): number {
    return this.#qualityLevel;
  }

  setBlockSize(value: number): void {
    this.#blockSize = value;
  }

  setHarrisDetector(value: boolean): void {
    this.#harrisDetector = value;
  }

  setK(value: number): void {
    this.#k = value;
  }

  setMaxFeatures(value: number): void {
    this.#maxFeatures = value;
  }

  setMinDistance(value: number): void {
    this.#minDistance = value;
  }

  setQualityLevel(value: number): void {
    this.#qualityLevel = value;
  }
}

class CopyingKAZEHandle implements WasmKAZEHandle {
  #diffusivity: number;
  #extended: boolean;
  #freed = false;
  #octaveLayers: number;
  #octaves: number;
  #threshold: number;
  #upright: boolean;

  constructor(
    extended: boolean,
    upright: boolean,
    threshold: number,
    octaves: number,
    octaveLayers: number,
    diffusivity: number,
    readonly onFree: () => void,
  ) {
    this.#extended = extended;
    this.#upright = upright;
    this.#threshold = threshold;
    this.#octaves = octaves;
    this.#octaveLayers = octaveLayers;
    this.#diffusivity = diffusivity;
  }

  free(): void {
    if (this.#freed) return;
    this.#freed = true;
    this.onFree();
  }

  getDefaultName(): string {
    return "Feature2D.KAZE";
  }

  getDiffusivity(): number {
    return this.#diffusivity;
  }

  getExtended(): boolean {
    return this.#extended;
  }

  getNOctaveLayers(): number {
    return this.#octaveLayers;
  }

  getNOctaves(): number {
    return this.#octaves;
  }

  getThreshold(): number {
    return this.#threshold;
  }

  getUpright(): boolean {
    return this.#upright;
  }

  setDiffusivity(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 3) {
      throw new OpenCvInputError("invalid KAZE diffusivity");
    }
    this.#diffusivity = value;
  }

  setExtended(value: boolean): void {
    this.#extended = value;
  }

  setNOctaveLayers(value: number): void {
    this.#octaveLayers = value;
  }

  setNOctaves(value: number): void {
    this.#octaves = value;
  }

  setThreshold(value: number): void {
    this.#threshold = value;
  }

  setUpright(value: boolean): void {
    this.#upright = value;
  }
}

class CopyingAgastFeatureDetectorHandle implements WasmAgastFeatureDetectorHandle {
  #freed = false;
  #nonmaxSuppression: boolean;
  #threshold: number;
  #type: number;

  constructor(
    threshold: number,
    nonmaxSuppression: boolean,
    type: number,
    readonly onFree: () => void,
  ) {
    this.#threshold = threshold;
    this.#nonmaxSuppression = nonmaxSuppression;
    this.#type = type;
  }

  free(): void {
    if (this.#freed) return;
    this.#freed = true;
    this.onFree();
  }

  getDefaultName(): string {
    return "Feature2D.AgastFeatureDetector";
  }

  getNonmaxSuppression(): boolean {
    return this.#nonmaxSuppression;
  }

  getThreshold(): number {
    return this.#threshold;
  }

  getType(): number {
    return this.#type;
  }

  setNonmaxSuppression(value: boolean): void {
    this.#nonmaxSuppression = value;
  }

  setThreshold(value: number): void {
    this.#threshold = value;
  }

  setType(value: number): void {
    this.#type = value;
  }
}

class CopyingFastFeatureDetectorHandle implements WasmFastFeatureDetectorHandle {
  #freed = false;
  #nonmaxSuppression: boolean;
  #threshold: number;
  #type: number;

  constructor(
    threshold: number,
    nonmaxSuppression: boolean,
    type: number,
    readonly onFree: () => void,
  ) {
    this.#threshold = threshold;
    this.#nonmaxSuppression = nonmaxSuppression;
    this.#type = type;
  }

  free(): void {
    if (this.#freed) return;
    this.#freed = true;
    this.onFree();
  }

  getDefaultName(): string {
    return "Feature2D.FastFeatureDetector";
  }

  getNonmaxSuppression(): boolean {
    return this.#nonmaxSuppression;
  }

  getThreshold(): number {
    return this.#threshold;
  }

  getType(): number {
    return this.#type;
  }

  setNonmaxSuppression(value: boolean): void {
    this.#nonmaxSuppression = value;
  }

  setThreshold(value: number): void {
    this.#threshold = value;
  }

  setType(value: number): void {
    this.#type = value;
  }
}

function depthByteWidth(depth: number): number {
  if (depth === 0 || depth === 1) {
    return 1;
  }
  if (depth === 2 || depth === 3) {
    return 2;
  }
  if (depth === 4 || depth === 5) {
    return 4;
  }
  return 8;
}

function copyViewBytes(data: ArrayBufferView): Uint8Array {
  return new Uint8Array(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}

function mergeHandles(sources: readonly WasmMatHandle[]): WasmMatHandle {
  const first = sources[0];
  if (first === undefined) {
    throw new OpenCvInputError("merge requires a source");
  }
  const scalarWidth = depthByteWidth(first.depth);
  const channels = sources.reduce((total, source) => total + source.channels, 0);
  const output = new Uint8Array(first.rows * first.columns * channels * scalarWidth);
  for (let pixel = 0; pixel < first.rows * first.columns; pixel += 1) {
    let targetChannel = 0;
    for (const source of sources) {
      const bytes = source.toUint8Array();
      const sourceStart = pixel * source.channels * scalarWidth;
      const targetStart = (pixel * channels + targetChannel) * scalarWidth;
      output.set(
        bytes.subarray(sourceStart, sourceStart + source.channels * scalarWidth),
        targetStart,
      );
      targetChannel += source.channels;
    }
  }
  return new CopyingMatHandle(first.rows, first.columns, channels, output, first.depth);
}

function concatHandles(
  sources: readonly WasmMatHandle[],
  direction: "horizontal" | "vertical",
): WasmMatHandle {
  const first = sources[0];
  if (first === undefined) throw new OpenCvInputError("concat requires a source");
  const rowBytes = (matrix: WasmMatHandle) =>
    matrix.columns * matrix.channels * depthByteWidth(matrix.depth);
  if (direction === "vertical") {
    const output = new Uint8Array(sources.reduce((total, source) => total + source.byteLength, 0));
    let offset = 0;
    for (const source of sources) {
      output.set(source.toUint8Array(), offset);
      offset += source.byteLength;
    }
    return new CopyingMatHandle(
      sources.reduce((total, source) => total + source.rows, 0),
      first.columns,
      first.channels,
      output,
      first.depth,
    );
  }
  const outputColumns = sources.reduce((total, source) => total + source.columns, 0);
  const output = new Uint8Array(
    first.rows * outputColumns * first.channels * depthByteWidth(first.depth),
  );
  let offset = 0;
  for (let row = 0; row < first.rows; row += 1) {
    for (const source of sources) {
      const bytes = source.toUint8Array();
      const width = rowBytes(source);
      output.set(bytes.subarray(row * width, (row + 1) * width), offset);
      offset += width;
    }
  }
  return new CopyingMatHandle(first.rows, outputColumns, first.channels, output, first.depth);
}

function floatValues(source: WasmMatHandle): Float32Array | Float64Array {
  return source.depth === 5 ? source.toFloat32Array() : source.toFloat64Array();
}

function floatHandle(source: WasmMatHandle, values: readonly number[]): WasmMatHandle {
  const typed = source.depth === 5 ? new Float32Array(values) : new Float64Array(values);
  return new CopyingMatHandle(
    source.rows,
    source.columns,
    source.channels,
    copyViewBytes(typed),
    source.depth,
  );
}

function mapFloatHandle(
  source: WasmMatHandle,
  operation: (value: number) => number,
): WasmMatHandle {
  return floatHandle(source, Array.from(floatValues(source), operation));
}

function zipFloatHandles(
  left: WasmMatHandle,
  right: WasmMatHandle,
  operation: (left: number, right: number) => number,
): WasmMatHandle {
  const leftValues = floatValues(left);
  const rightValues = floatValues(right);
  return floatHandle(
    left,
    Array.from(leftValues, (value, index) => operation(value, rightValues[index] ?? Number.NaN)),
  );
}

function binaryNumericU8(
  left: WasmMatHandle,
  right: WasmMatHandle,
  operation: (left: number, right: number) => number,
): WasmMatHandle {
  const rightBytes = right.toUint8Array();
  const output = Uint8Array.from(left.toUint8Array(), (value, index) =>
    Math.min(255, Math.max(0, Math.round(operation(value, rightBytes[index] ?? 0)))),
  );
  return new CopyingMatHandle(left.rows, left.columns, left.channels, output);
}

function normBytes(values: Uint8Array, normType: number): number {
  const baseType = normType & 7;
  if (baseType === 1) return Math.max(0, ...values);
  if (baseType === 2) return values.reduce((sum, value) => sum + Math.abs(value), 0);
  if (baseType === 5) return values.reduce((sum, value) => sum + value * value, 0);
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

function maskedBytes(source: WasmMatHandle, mask: WasmMatHandle): Uint8Array {
  const input = source.toUint8Array();
  const selected = mask.toUint8Array();
  const output: number[] = [];
  for (let pixel = 0; pixel < source.rows * source.columns; pixel += 1) {
    if (selected[pixel] === 0) continue;
    const offset = pixel * source.channels;
    output.push(...input.subarray(offset, offset + source.channels));
  }
  return Uint8Array.from(output);
}

function writeMeanStdDev(
  source: WasmMatHandle,
  means: WasmMatHandle,
  deviations: WasmMatHandle,
  mask?: WasmMatHandle,
): void {
  const input = source.toUint8Array();
  const selected = mask?.toUint8Array();
  const channels: number[][] = Array.from({ length: source.channels }, () => []);
  for (let pixel = 0; pixel < source.rows * source.columns; pixel += 1) {
    if (selected !== undefined && selected[pixel] === 0) continue;
    for (let channel = 0; channel < source.channels; channel += 1) {
      channels[channel]?.push(input[pixel * source.channels + channel] ?? 0);
    }
  }
  const average = channels.map((values) =>
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length,
  );
  const standardDeviation = channels.map((values, channel) => {
    const mean = average[channel] ?? 0;
    return values.length === 0
      ? 0
      : Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  });
  means.copyFromBytes(copyViewBytes(new Float64Array(average)));
  deviations.copyFromBytes(copyViewBytes(new Float64Array(standardDeviation)));
}

class CopyingBackend implements OpenCvBackend {
  #agastFeatureDetectorFreeCount = 0;
  #akazeFreeCount = 0;
  #fastFeatureDetectorFreeCount = 0;
  #gfttDetectorFreeCount = 0;
  #kazeFreeCount = 0;
  #logLevel = 3;
  #randomState = 0;
  readonly cartToPolarDegreeFlags: boolean[] = [];
  readonly numericIntoCalls: Array<{
    readonly method: string;
    readonly scale: number;
    readonly dtype: number;
  }> = [];
  readonly optimalDftSizeInputs: number[] = [];
  readonly pointPolygonTestInputs: Array<{
    readonly x: number;
    readonly y: number;
    readonly measureDistance: boolean;
  }> = [];
  readonly rotationMatrixInputs: Array<{
    readonly centerX: number;
    readonly centerY: number;
    readonly angleDegrees: number;
    readonly scale: number;
  }> = [];
  readonly polarToCartDegreeFlags: boolean[] = [];

  readonly AKAZE: WasmAKAZEFactory = {
    create: (
      descriptorType,
      descriptorSize,
      descriptorChannels,
      threshold,
      octaves,
      octaveLayers,
      diffusivity,
      maxPoints,
    ): WasmAKAZEHandle => {
      const resolvedMaxPoints = maxPoints ?? AKAZE_DEFAULTS.maxPoints;
      if (!Number.isInteger(resolvedMaxPoints)) {
        throw new OpenCvInputError("invalid AKAZE maximum point count");
      }
      return new CopyingAKAZEHandle(
        descriptorType ?? AKAZE_DEFAULTS.descriptorType,
        descriptorSize ?? AKAZE_DEFAULTS.descriptorSize,
        descriptorChannels ?? AKAZE_DEFAULTS.descriptorChannels,
        threshold ?? AKAZE_DEFAULTS.threshold,
        octaves ?? AKAZE_DEFAULTS.octaves,
        octaveLayers ?? AKAZE_DEFAULTS.octaveLayers,
        diffusivity ?? AKAZE_DEFAULTS.diffusivity,
        () => {
          this.#akazeFreeCount += 1;
        },
      );
    },
  };

  readonly KAZE: WasmKAZEFactory = {
    create: (extended, upright, threshold, octaves, octaveLayers, diffusivity): WasmKAZEHandle =>
      new CopyingKAZEHandle(
        extended ?? KAZE_DEFAULTS.extended,
        upright ?? KAZE_DEFAULTS.upright,
        threshold ?? KAZE_DEFAULTS.threshold,
        octaves ?? KAZE_DEFAULTS.octaves,
        octaveLayers ?? KAZE_DEFAULTS.octaveLayers,
        diffusivity ?? KAZE_DEFAULTS.diffusivity,
        () => {
          this.#kazeFreeCount += 1;
        },
      ),
  };

  readonly GFTTDetector: WasmGFTTDetectorFactory = {
    create: (
      maxFeatures,
      qualityLevel,
      minDistance,
      blockSize,
      useHarrisDetector,
      k,
    ): WasmGFTTDetectorHandle =>
      new CopyingGFTTDetectorHandle(
        maxFeatures ?? GFTT_DETECTOR_DEFAULTS.maxFeatures,
        qualityLevel ?? GFTT_DETECTOR_DEFAULTS.qualityLevel,
        minDistance ?? GFTT_DETECTOR_DEFAULTS.minDistance,
        blockSize ?? GFTT_DETECTOR_DEFAULTS.blockSize,
        useHarrisDetector ?? GFTT_DETECTOR_DEFAULTS.useHarrisDetector,
        k ?? GFTT_DETECTOR_DEFAULTS.k,
        () => {
          this.#gfttDetectorFreeCount += 1;
        },
      ),
  };

  readonly AgastFeatureDetector: WasmAgastFeatureDetectorFactory = {
    create: (threshold, nonmaxSuppression, type): WasmAgastFeatureDetectorHandle =>
      new CopyingAgastFeatureDetectorHandle(
        threshold ?? AGAST_FEATURE_DETECTOR_DEFAULTS.threshold,
        nonmaxSuppression ?? AGAST_FEATURE_DETECTOR_DEFAULTS.nonmaxSuppression,
        type ?? AGAST_FEATURE_DETECTOR_DEFAULTS.type,
        () => {
          this.#agastFeatureDetectorFreeCount += 1;
        },
      ),
  };

  get agastFeatureDetectorFreeCount(): number {
    return this.#agastFeatureDetectorFreeCount;
  }

  get kazeFreeCount(): number {
    return this.#kazeFreeCount;
  }

  get gfttDetectorFreeCount(): number {
    return this.#gfttDetectorFreeCount;
  }

  readonly FastFeatureDetector: WasmFastFeatureDetectorFactory = {
    create: (threshold, nonmaxSuppression, type): WasmFastFeatureDetectorHandle =>
      new CopyingFastFeatureDetectorHandle(
        threshold ?? FAST_FEATURE_DETECTOR_DEFAULTS.threshold,
        nonmaxSuppression ?? FAST_FEATURE_DETECTOR_DEFAULTS.nonmaxSuppression,
        type ?? FAST_FEATURE_DETECTOR_DEFAULTS.type,
        () => {
          this.#fastFeatureDetectorFreeCount += 1;
        },
      ),
  };

  get fastFeatureDetectorFreeCount(): number {
    return this.#fastFeatureDetectorFreeCount;
  }

  get akazeFreeCount(): number {
    return this.#akazeFreeCount;
  }

  clipLine(
    rectangleX: number,
    rectangleY: number,
    rectangleWidth: number,
    rectangleHeight: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): Int32Array {
    const minimumX = rectangleX;
    const maximumX = rectangleX + rectangleWidth - 1;
    const minimumY = rectangleY;
    const maximumY = rectangleY + rectangleHeight - 1;
    if (startY === endY && startY >= minimumY && startY <= maximumY) {
      const clippedStart = Math.max(minimumX, Math.min(maximumX, startX));
      const clippedEnd = Math.max(minimumX, Math.min(maximumX, endX));
      if (Math.max(startX, endX) < minimumX || Math.min(startX, endX) > maximumX) {
        return new Int32Array();
      }
      return new Int32Array([clippedStart, startY, clippedEnd, endY]);
    }
    return new Int32Array();
  }

  createHanningWindow(columns: number, rows: number, depth: number): WasmMatHandle {
    const values = Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      return cleanTiny(
        Math.sin((Math.PI * row) / (rows - 1)) * Math.sin((Math.PI * column) / (columns - 1)),
      );
    });
    const typed = depth === 5 ? new Float32Array(values) : new Float64Array(values);
    return new CopyingMatHandle(rows, columns, 1, copyViewBytes(typed), depth);
  }

  ellipse2Poly(
    centerX: number,
    centerY: number,
    axisX: number,
    axisY: number,
    rotationDegrees: number,
    arcStart: number,
    arcEnd: number,
    delta: number,
  ): Int32Array {
    const rotation = (rotationDegrees * Math.PI) / 180;
    const output: number[] = [];
    for (let angle = arcStart; angle <= arcEnd; angle += delta) {
      const radians = (Math.min(angle, arcEnd) * Math.PI) / 180;
      const x = axisX * Math.cos(radians);
      const y = axisY * Math.sin(radians);
      output.push(
        Math.round(centerX + x * Math.cos(rotation) - y * Math.sin(rotation)),
        Math.round(centerY + x * Math.sin(rotation) + y * Math.cos(rotation)),
      );
      if (angle + delta > arcEnd && angle !== arcEnd) angle = arcEnd - delta;
    }
    return new Int32Array(output);
  }

  getStructuringElement(
    kind: number,
    columns: number,
    rows: number,
    anchorX: number,
    anchorY: number,
  ): WasmMatHandle {
    const resolvedX = anchorX === -1 ? Math.floor(columns / 2) : anchorX;
    const resolvedY = anchorY === -1 ? Math.floor(rows / 2) : anchorY;
    const output = Uint8Array.from({ length: rows * columns }, (_, index) => {
      if (kind === 0) return 1;
      const row = Math.floor(index / columns);
      const column = index % columns;
      return kind === 1
        ? Number(row === resolvedY || column === resolvedX)
        : Number(
            ((column - resolvedX) / Math.max(resolvedX, 1)) ** 2 +
              ((row - resolvedY) / Math.max(resolvedY, 1)) ** 2 <=
              1,
          );
    });
    return new CopyingMatHandle(rows, columns, 1, output);
  }

  getLogLevel(): number {
    return this.#logLevel;
  }

  getOptimalDFTSize(size: number): number {
    this.optimalDftSizeInputs.push(size);
    if (size < 0 || size === 2_125_764_000) return -1;
    for (let candidate = Math.max(size, 1); candidate <= 2_125_764_000; candidate += 1) {
      let remainder = candidate;
      for (const factor of [2, 3, 5]) {
        while (remainder % factor === 0) remainder /= factor;
      }
      if (remainder === 1) return candidate;
    }
    return -1;
  }

  grayscaleRgba(data: Uint8Array): Uint8Array {
    return new Uint8Array(data);
  }

  invertRgba(data: Uint8Array): Uint8Array {
    return new Uint8Array(data);
  }

  matFromF32(data: Float32Array, rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, copyViewBytes(data), 5);
  }

  matFromF64(data: Float64Array, rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, copyViewBytes(data), 6);
  }

  matFromI16(data: Int16Array, rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, copyViewBytes(data), 3);
  }

  matFromI32(data: Int32Array, rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, copyViewBytes(data), 4);
  }

  matFromI8(data: Int8Array, rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, copyViewBytes(data), 1);
  }

  matFromU16(data: Uint16Array, rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, copyViewBytes(data), 2);
  }

  matFromU8(data: Uint8Array, rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, new Uint8Array(data));
  }

  matEmpty(): WasmMatHandle {
    return new CopyingMatHandle(0, 0, 1, new Uint8Array());
  }

  matFlip(source: WasmMatHandle, flipCode: number): WasmMatHandle {
    const input = source.toUint8Array();
    const output = new Uint8Array(input.byteLength);
    const pixelBytes = source.channels * depthByteWidth(source.depth);
    for (let row = 0; row < source.rows; row += 1) {
      for (let column = 0; column < source.columns; column += 1) {
        const sourceRow = flipCode <= 0 ? source.rows - row - 1 : row;
        const sourceColumn = flipCode !== 0 ? source.columns - column - 1 : column;
        const sourceOffset = (sourceRow * source.columns + sourceColumn) * pixelBytes;
        const outputOffset = (row * source.columns + column) * pixelBytes;
        output.set(input.subarray(sourceOffset, sourceOffset + pixelBytes), outputOffset);
      }
    }
    return new CopyingMatHandle(source.rows, source.columns, source.channels, output, source.depth);
  }

  matFlipInto(source: WasmMatHandle, destination: WasmMatHandle, flipCode: number): void {
    destination.copyFromBytes(this.matFlip(source, flipCode).toUint8Array());
  }

  matSplit(source: WasmMatHandle): WasmMatHandle[] {
    const scalarWidth = depthByteWidth(source.depth);
    const input = source.toUint8Array();
    return Array.from({ length: source.channels }, (_, channel) => {
      const output = new Uint8Array(source.rows * source.columns * scalarWidth);
      for (let pixel = 0; pixel < source.rows * source.columns; pixel += 1) {
        const inputOffset = (pixel * source.channels + channel) * scalarWidth;
        output.set(input.subarray(inputOffset, inputOffset + scalarWidth), pixel * scalarWidth);
      }
      return new CopyingMatHandle(source.rows, source.columns, 1, output, source.depth);
    });
  }

  matMerge(first: WasmMatHandle, second: WasmMatHandle): WasmMatHandle {
    return mergeHandles([first, second]);
  }

  matMerge3(first: WasmMatHandle, second: WasmMatHandle, third: WasmMatHandle): WasmMatHandle {
    return mergeHandles([first, second, third]);
  }

  matMerge4(
    first: WasmMatHandle,
    second: WasmMatHandle,
    third: WasmMatHandle,
    fourth: WasmMatHandle,
  ): WasmMatHandle {
    return mergeHandles([first, second, third, fourth]);
  }

  matMixChannels(source: WasmMatHandle, destination: WasmMatHandle, fromTo: Uint16Array): void {
    const scalarWidth = depthByteWidth(source.depth);
    const input = source.toUint8Array();
    const output = destination.toUint8Array();
    for (let pixel = 0; pixel < source.rows * source.columns; pixel += 1) {
      for (let index = 0; index < fromTo.length; index += 2) {
        const sourceChannel = fromTo[index] ?? 0;
        const destinationChannel = fromTo[index + 1] ?? 0;
        const sourceOffset = (pixel * source.channels + sourceChannel) * scalarWidth;
        const destinationOffset = (pixel * destination.channels + destinationChannel) * scalarWidth;
        output.set(input.subarray(sourceOffset, sourceOffset + scalarWidth), destinationOffset);
      }
    }
    destination.copyFromBytes(output);
  }

  matExtractChannel(source: WasmMatHandle, channel: number): WasmMatHandle {
    const output = this.matSplit(source)[channel];
    if (output === undefined) {
      throw new OpenCvInputError("channel is out of bounds");
    }
    return output;
  }

  matInsertChannel(source: WasmMatHandle, destination: WasmMatHandle, channel: number): void {
    const scalarWidth = depthByteWidth(destination.depth);
    const input = source.toUint8Array();
    const output = destination.toUint8Array();
    for (let pixel = 0; pixel < destination.rows * destination.columns; pixel += 1) {
      const sourceOffset = pixel * scalarWidth;
      const destinationOffset = (pixel * destination.channels + channel) * scalarWidth;
      output.set(input.subarray(sourceOffset, sourceOffset + scalarWidth), destinationOffset);
    }
    destination.copyFromBytes(output);
  }

  matLut(source: WasmMatHandle, table: WasmMatHandle): WasmMatHandle {
    const input = source.toUint8Array();
    const lookup = table.toUint8Array();
    const output = Uint8Array.from(input, (value, index) => {
      const channel = index % source.channels;
      const tableChannel = table.channels === 1 ? 0 : channel;
      return lookup[value * table.channels + tableChannel] ?? 0;
    });
    return new CopyingMatHandle(source.rows, source.columns, source.channels, output, table.depth);
  }

  matLutInto(source: WasmMatHandle, table: WasmMatHandle, destination: WasmMatHandle): void {
    destination.copyFromBytes(this.matLut(source, table).toUint8Array());
  }

  matNorm(source: WasmMatHandle, normType: number): number {
    return normBytes(source.toUint8Array(), normType);
  }

  matNormMasked(source: WasmMatHandle, normType: number, mask: WasmMatHandle): number {
    return normBytes(maskedBytes(source, mask), normType);
  }

  matNormDiff(first: WasmMatHandle, second: WasmMatHandle, normType: number): number {
    const right = second.toUint8Array();
    return normBytes(
      Uint8Array.from(first.toUint8Array(), (value, index) =>
        Math.abs(value - (right[index] ?? 0)),
      ),
      normType,
    );
  }

  matNormDiffMasked(
    first: WasmMatHandle,
    second: WasmMatHandle,
    normType: number,
    mask: WasmMatHandle,
  ): number {
    const right = second.toUint8Array();
    const difference = Uint8Array.from(first.toUint8Array(), (value, index) =>
      Math.abs(value - (right[index] ?? 0)),
    );
    const handle = new CopyingMatHandle(first.rows, first.columns, first.channels, difference);
    return normBytes(maskedBytes(handle, mask), normType);
  }

  matNormalizeInto(
    source: WasmMatHandle,
    destination: WasmMatHandle,
    alpha: number,
    beta: number,
    normType: number,
  ): void {
    const input = source.toUint8Array();
    const denominator = normBytes(input, normType);
    destination.copyFromBytes(
      Uint8Array.from(input, (value) =>
        Math.round(denominator === 0 ? 0 : (value * alpha) / denominator + beta),
      ),
    );
  }

  matNormalizeMaskedInto(
    source: WasmMatHandle,
    destination: WasmMatHandle,
    alpha: number,
    beta: number,
    normType: number,
    mask: WasmMatHandle,
  ): void {
    const before = destination.toUint8Array();
    const temporary = new CopyingMatHandle(
      source.rows,
      source.columns,
      source.channels,
      new Uint8Array(source.byteLength),
    );
    this.matNormalizeInto(source, temporary, alpha, beta, normType);
    const normalized = temporary.toUint8Array();
    const maskBytes = mask.toUint8Array();
    for (let pixel = 0; pixel < source.rows * source.columns; pixel += 1) {
      if (maskBytes[pixel] === 0) continue;
      const offset = pixel * source.channels;
      before.set(normalized.subarray(offset, offset + source.channels), offset);
    }
    destination.copyFromBytes(before);
  }

  matMeanStdDevInto(
    source: WasmMatHandle,
    means: WasmMatHandle,
    standardDeviations: WasmMatHandle,
  ): void {
    writeMeanStdDev(source, means, standardDeviations);
  }

  matMeanStdDevMaskedInto(
    source: WasmMatHandle,
    means: WasmMatHandle,
    standardDeviations: WasmMatHandle,
    mask: WasmMatHandle,
  ): void {
    writeMeanStdDev(source, means, standardDeviations, mask);
  }

  matReduceInto(
    source: WasmMatHandle,
    destination: WasmMatHandle,
    axis: number,
    kind: number,
  ): void {
    const input = source.toUint8Array();
    const output: number[] = [];
    const major = axis === 0 ? source.columns : source.rows;
    const count = axis === 0 ? source.rows : source.columns;
    for (let position = 0; position < major; position += 1) {
      for (let channel = 0; channel < source.channels; channel += 1) {
        const values: number[] = [];
        for (let index = 0; index < count; index += 1) {
          const row = axis === 0 ? index : position;
          const column = axis === 0 ? position : index;
          values.push(input[(row * source.columns + column) * source.channels + channel] ?? 0);
        }
        const sum = values.reduce((total, value) => total + value, 0);
        output.push(
          kind === 0
            ? sum
            : kind === 1
              ? Math.round(sum / values.length)
              : kind === 2
                ? Math.max(...values)
                : Math.min(...values),
        );
      }
    }
    destination.copyFromBytes(Uint8Array.from(output));
  }

  matRandn(destination: WasmMatHandle, mean: Float64Array, standardDeviation: Float64Array): void {
    const meanValue = mean[0] ?? 0;
    const deviation = standardDeviation[0] ?? 0;
    if (destination.depth === 6 && deviation === 0) {
      destination.copyFromBytes(
        copyViewBytes(new Float64Array(destination.rows * destination.columns).fill(meanValue)),
      );
      return;
    }
    throw new OpenCvInputError("fake backend only implements constant F64 normal fills");
  }

  matRandu(destination: WasmMatHandle, lower: Float64Array, upper: Float64Array): void {
    const low = lower[0] ?? 0;
    const high = upper[0] ?? 0;
    destination.copyFromBytes(
      Uint8Array.from({ length: destination.byteLength }, () => {
        this.#randomState = (Math.imul(this.#randomState, 1_664_525) + 1_013_904_223) | 0;
        const unit = (this.#randomState >>> 0) / 4_294_967_296;
        return Math.floor(low + (high - low) * unit);
      }),
    );
  }

  matSetIdentity(destination: WasmMatHandle, value: Float64Array): void {
    const output = new Uint8Array(destination.byteLength);
    const diagonal = Math.min(destination.rows, destination.columns);
    for (let position = 0; position < diagonal; position += 1) {
      output[(position * destination.columns + position) * destination.channels] = Math.round(
        value[0] ?? 0,
      );
    }
    destination.copyFromBytes(output);
  }

  matHconcat2(first: WasmMatHandle, second: WasmMatHandle): WasmMatHandle {
    return concatHandles([first, second], "horizontal");
  }

  matHconcat3(first: WasmMatHandle, second: WasmMatHandle, third: WasmMatHandle): WasmMatHandle {
    return concatHandles([first, second, third], "horizontal");
  }

  matHconcat4(
    first: WasmMatHandle,
    second: WasmMatHandle,
    third: WasmMatHandle,
    fourth: WasmMatHandle,
  ): WasmMatHandle {
    return concatHandles([first, second, third, fourth], "horizontal");
  }

  matVconcat2(first: WasmMatHandle, second: WasmMatHandle): WasmMatHandle {
    return concatHandles([first, second], "vertical");
  }

  matVconcat3(first: WasmMatHandle, second: WasmMatHandle, third: WasmMatHandle): WasmMatHandle {
    return concatHandles([first, second, third], "vertical");
  }

  matVconcat4(
    first: WasmMatHandle,
    second: WasmMatHandle,
    third: WasmMatHandle,
    fourth: WasmMatHandle,
  ): WasmMatHandle {
    return concatHandles([first, second, third, fourth], "vertical");
  }

  matExp(source: WasmMatHandle): WasmMatHandle {
    return mapFloatHandle(source, Math.exp);
  }

  matExpInto(source: WasmMatHandle, destination: WasmMatHandle): void {
    destination.copyFromBytes(this.matExp(source).toUint8Array());
  }

  matLog(source: WasmMatHandle): WasmMatHandle {
    return mapFloatHandle(source, Math.log);
  }

  matLogInto(source: WasmMatHandle, destination: WasmMatHandle): void {
    destination.copyFromBytes(this.matLog(source).toUint8Array());
  }

  matSqrt(source: WasmMatHandle): WasmMatHandle {
    return mapFloatHandle(source, Math.sqrt);
  }

  matSqrtInto(source: WasmMatHandle, destination: WasmMatHandle): void {
    destination.copyFromBytes(this.matSqrt(source).toUint8Array());
  }

  matPow(source: WasmMatHandle, exponent: number): WasmMatHandle {
    return mapFloatHandle(source, (value) => value ** exponent);
  }

  matPowInto(source: WasmMatHandle, exponent: number, destination: WasmMatHandle): void {
    destination.copyFromBytes(this.matPow(source, exponent).toUint8Array());
  }

  matMagnitude(x: WasmMatHandle, y: WasmMatHandle): WasmMatHandle {
    return zipFloatHandles(x, y, Math.hypot);
  }

  matMagnitudeInto(x: WasmMatHandle, y: WasmMatHandle, destination: WasmMatHandle): void {
    destination.copyFromBytes(this.matMagnitude(x, y).toUint8Array());
  }

  matCartToPolar(
    x: WasmMatHandle,
    y: WasmMatHandle,
    magnitude: WasmMatHandle,
    angle: WasmMatHandle,
    degrees: boolean,
  ): void {
    this.cartToPolarDegreeFlags.push(degrees);
    magnitude.copyFromBytes(this.matMagnitude(x, y).toUint8Array());
    const scale = degrees ? 180 / Math.PI : 1;
    angle.copyFromBytes(
      zipFloatHandles(x, y, (xValue, yValue) => Math.atan2(yValue, xValue) * scale).toUint8Array(),
    );
  }

  matPolarToCart(
    magnitude: WasmMatHandle,
    angle: WasmMatHandle,
    x: WasmMatHandle,
    y: WasmMatHandle,
    degrees: boolean,
  ): void {
    this.polarToCartDegreeFlags.push(degrees);
    const scale = degrees ? Math.PI / 180 : 1;
    x.copyFromBytes(
      zipFloatHandles(
        magnitude,
        angle,
        (length, direction) => length * Math.cos(direction * scale),
      ).toUint8Array(),
    );
    y.copyFromBytes(
      zipFloatHandles(
        magnitude,
        angle,
        (length, direction) => length * Math.sin(direction * scale),
      ).toUint8Array(),
    );
  }

  matMultiply(a: WasmMatHandle, b: WasmMatHandle, scale: number): WasmMatHandle {
    return binaryNumericU8(a, b, (left, right) => left * right * scale);
  }

  matMultiplyInto(
    a: WasmMatHandle,
    b: WasmMatHandle,
    destination: WasmMatHandle,
    scale: number,
    dtype: number,
  ): void {
    this.numericIntoCalls.push({ method: "multiply", scale, dtype });
    destination.copyFromBytes(this.matMultiply(a, b, scale).toUint8Array());
  }

  matDivide(a: WasmMatHandle, b: WasmMatHandle, scale: number): WasmMatHandle {
    return binaryNumericU8(a, b, (left, right) => (right === 0 ? 0 : (left * scale) / right));
  }

  matDivideInto(
    a: WasmMatHandle,
    b: WasmMatHandle,
    destination: WasmMatHandle,
    scale: number,
    dtype: number,
  ): void {
    this.numericIntoCalls.push({ method: "divide", scale, dtype });
    destination.copyFromBytes(this.matDivide(a, b, scale).toUint8Array());
  }

  matAddWeighted(
    a: WasmMatHandle,
    alpha: number,
    b: WasmMatHandle,
    beta: number,
    gamma: number,
  ): WasmMatHandle {
    return binaryNumericU8(a, b, (left, right) => left * alpha + right * beta + gamma);
  }

  matAddWeightedInto(
    a: WasmMatHandle,
    alpha: number,
    b: WasmMatHandle,
    beta: number,
    gamma: number,
    destination: WasmMatHandle,
    dtype: number,
  ): void {
    this.numericIntoCalls.push({ method: "addWeighted", scale: 1, dtype });
    destination.copyFromBytes(this.matAddWeighted(a, alpha, b, beta, gamma).toUint8Array());
  }

  matConvertScaleAbs(source: WasmMatHandle, alpha: number, beta: number): WasmMatHandle {
    const output = Uint8Array.from(source.toUint8Array(), (value) =>
      Math.min(255, Math.max(0, Math.round(Math.abs(value * alpha + beta)))),
    );
    return new CopyingMatHandle(source.rows, source.columns, source.channels, output);
  }

  matConvertScaleAbsInto(
    source: WasmMatHandle,
    destination: WasmMatHandle,
    alpha: number,
    beta: number,
  ): void {
    destination.copyFromBytes(this.matConvertScaleAbs(source, alpha, beta).toUint8Array());
  }

  matCopyMakeBorder(
    source: WasmMatHandle,
    top: number,
    bottom: number,
    left: number,
    right: number,
    borderType: number,
    constant: Float64Array,
  ): WasmMatHandle {
    if (borderType !== 0 && borderType !== 16) {
      throw new OpenCvInputError("fake backend only implements constant borders");
    }
    const rows = source.rows + top + bottom;
    const columns = source.columns + left + right;
    const output = new Uint8Array(rows * columns * source.channels);
    for (let index = 0; index < output.length; index += 1) {
      output[index] = Math.round(constant[index % source.channels] ?? 0);
    }
    const input = source.toUint8Array();
    for (let row = 0; row < source.rows; row += 1) {
      const target = ((row + top) * columns + left) * source.channels;
      const start = row * source.columns * source.channels;
      output.set(input.subarray(start, start + source.columns * source.channels), target);
    }
    return new CopyingMatHandle(rows, columns, source.channels, output, source.depth);
  }

  matCopyMakeBorderInto(
    source: WasmMatHandle,
    destination: WasmMatHandle,
    top: number,
    bottom: number,
    left: number,
    right: number,
    borderType: number,
    constant: Float64Array,
  ): void {
    destination.copyFromBytes(
      this.matCopyMakeBorder(source, top, bottom, left, right, borderType, constant).toUint8Array(),
    );
  }

  matAbsdiffU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, (leftValue, rightValue) => Math.abs(leftValue - rightValue));
  }

  matAddU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, (leftValue, rightValue) => Math.min(leftValue + rightValue, 255));
  }

  matBitwiseAndU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, (leftValue, rightValue) => leftValue & rightValue);
  }

  matBitwiseNotU8(source: WasmMatHandle): WasmMatHandle {
    return unaryU8(source, (value) => ~value & 255);
  }

  matBitwiseOrU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, (leftValue, rightValue) => leftValue | rightValue);
  }

  matBitwiseXorU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, (leftValue, rightValue) => leftValue ^ rightValue);
  }

  matCompareEqU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, (leftValue, rightValue) => (leftValue === rightValue ? 255 : 0));
  }

  matCountNonZero(source: WasmMatHandle): number {
    return source.toUint8Array().reduce((count, value) => count + Number(value !== 0), 0);
  }

  matArcLength(contour: WasmMatHandle, closed: boolean): number {
    const points = contourPoints(contour);
    const pairCount = closed ? points.length : Math.max(points.length - 1, 0);
    let total = 0;
    for (let index = 0; index < pairCount; index += 1) {
      const start = requiredPoint(points, index);
      const end = requiredPoint(points, (index + 1) % points.length);
      total += Math.hypot(end.x - start.x, end.y - start.y);
    }
    return total;
  }

  matBoundingRect(contour: WasmMatHandle): Int32Array {
    const points = contourPoints(contour);
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minimumX = Math.floor(Math.min(...xs));
    const minimumY = Math.floor(Math.min(...ys));
    const maximumX = Math.floor(Math.max(...xs));
    const maximumY = Math.floor(Math.max(...ys));
    return new Int32Array([minimumX, minimumY, maximumX - minimumX + 1, maximumY - minimumY + 1]);
  }

  matContourArea(contour: WasmMatHandle, oriented: boolean): number {
    const points = contourPoints(contour);
    let twiceArea = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = requiredPoint(points, index);
      const next = requiredPoint(points, (index + 1) % points.length);
      twiceArea += current.x * next.y - next.x * current.y;
    }
    const area = twiceArea / 2;
    return oriented ? area : Math.abs(area);
  }

  matDeterminant(source: WasmMatHandle): number {
    const values = source.toFloat64Array();
    return (values[0] ?? 0) * (values[3] ?? 0) - (values[1] ?? 0) * (values[2] ?? 0);
  }

  matInRangeU8(
    source: WasmMatHandle,
    lowerBound: WasmMatHandle,
    upperBound: WasmMatHandle,
  ): WasmMatHandle {
    const values = source.toUint8Array();
    const lower = lowerBound.toUint8Array();
    const upper = upperBound.toUint8Array();
    const output = new Uint8Array(source.rows * source.columns);
    for (let pixel = 0; pixel < output.length; pixel += 1) {
      let inside = true;
      for (let channel = 0; channel < source.channels; channel += 1) {
        const index = pixel * source.channels + channel;
        const value = byteAt(values, index);
        inside &&= value >= byteAt(lower, index) && value <= byteAt(upper, index);
      }
      output[pixel] = inside ? 255 : 0;
    }
    return new CopyingMatHandle(source.rows, source.columns, 1, output);
  }

  matGetAffineTransform(source: WasmMatHandle, destination: WasmMatHandle): WasmMatHandle {
    const from = contourPoints(source);
    const to = contourPoints(destination);
    const origin = requiredPoint(to, 0);
    const sourceX = requiredPoint(from, 1).x - requiredPoint(from, 0).x;
    const sourceY = requiredPoint(from, 2).y - requiredPoint(from, 0).y;
    const scaleX = (requiredPoint(to, 1).x - origin.x) / sourceX;
    const scaleY = (requiredPoint(to, 2).y - origin.y) / sourceY;
    return f64Handle(2, 3, [scaleX, 0, origin.x, 0, scaleY, origin.y]);
  }

  matGetPerspectiveTransform(source: WasmMatHandle, destination: WasmMatHandle): WasmMatHandle {
    const affine = this.matGetAffineTransform(source, destination).toFloat64Array();
    return f64Handle(3, 3, [
      affine[0] ?? 0,
      affine[1] ?? 0,
      affine[2] ?? 0,
      affine[3] ?? 0,
      affine[4] ?? 0,
      affine[5] ?? 0,
      0,
      0,
      1,
    ]);
  }

  matGetRotationMatrix2D(
    centerX: number,
    centerY: number,
    angleDegrees: number,
    scale: number,
  ): WasmMatHandle {
    this.rotationMatrixInputs.push({ centerX, centerY, angleDegrees, scale });
    const radians = (angleDegrees * Math.PI) / 180;
    const alpha = scale * Math.cos(radians);
    const beta = scale * Math.sin(radians);
    return f64Handle(2, 3, [
      alpha,
      beta,
      (1 - alpha) * centerX - beta * centerY,
      -beta,
      alpha,
      beta * centerX + (1 - alpha) * centerY,
    ]);
  }

  matInvertAffineTransform(transform: WasmMatHandle): WasmMatHandle {
    const values = transform.toFloat64Array();
    const a = values[0] ?? 0;
    const b = values[1] ?? 0;
    const c = values[2] ?? 0;
    const d = values[3] ?? 0;
    const e = values[4] ?? 0;
    const f = values[5] ?? 0;
    const determinant = a * e - b * d;
    const inverseA = e / determinant;
    const inverseB = -b / determinant;
    const inverseD = -d / determinant;
    const inverseE = a / determinant;
    return f64Handle(
      2,
      3,
      [
        inverseA,
        inverseB,
        -(inverseA * c + inverseB * f),
        inverseD,
        inverseE,
        -(inverseD * c + inverseE * f),
      ].map(cleanTiny),
    );
  }

  matInvertInto(source: WasmMatHandle, destination: WasmMatHandle, _method: number): number {
    const values = source.toFloat64Array();
    const determinant = this.matDeterminant(source);
    if (determinant === 0) return 0;
    destination.copyFromBytes(
      copyViewBytes(
        new Float64Array([
          (values[3] ?? 0) / determinant,
          -(values[1] ?? 0) / determinant,
          -(values[2] ?? 0) / determinant,
          (values[0] ?? 0) / determinant,
        ]),
      ),
    );
    return 1;
  }

  matIsContourConvex(contour: WasmMatHandle): boolean {
    const points = contourPoints(contour);
    let direction = 0;
    for (let index = 0; index < points.length; index += 1) {
      const a = requiredPoint(points, index);
      const b = requiredPoint(points, (index + 1) % points.length);
      const c = requiredPoint(points, (index + 2) % points.length);
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (cross === 0) continue;
      const sign = Math.sign(cross);
      if (direction !== 0 && sign !== direction) return false;
      direction = sign;
    }
    return direction !== 0;
  }

  matPointPolygonTest(
    contour: WasmMatHandle,
    x: number,
    y: number,
    measureDistance: boolean,
  ): number {
    this.pointPolygonTestInputs.push({ x, y, measureDistance });
    const points = contourPoints(contour);
    let inside = false;
    let nearest = Number.POSITIVE_INFINITY;
    for (let index = 0; index < points.length; index += 1) {
      const start = requiredPoint(points, index);
      const end = requiredPoint(points, (index + 1) % points.length);
      nearest = Math.min(nearest, pointSegmentDistance(x, y, start, end));
      if (start.y > y !== end.y > y) {
        const crossingX = ((end.x - start.x) * (y - start.y)) / (end.y - start.y) + start.x;
        if (x < crossingX) inside = !inside;
      }
    }
    if (nearest === 0) return 0;
    if (!measureDistance) return inside ? 1 : -1;
    return inside ? nearest : -nearest;
  }

  matSolveInto(
    coefficients: WasmMatHandle,
    rightHandSides: WasmMatHandle,
    destination: WasmMatHandle,
    method: number,
  ): boolean {
    const inverse = new CopyingMatHandle(2, 2, 1, new Uint8Array(32), 6);
    if (this.matInvertInto(coefficients, inverse, method) === 0) return false;
    const inverseValues = inverse.toFloat64Array();
    const right = rightHandSides.toFloat64Array();
    destination.copyFromBytes(
      copyViewBytes(
        new Float64Array([
          (inverseValues[0] ?? 0) * (right[0] ?? 0) + (inverseValues[1] ?? 0) * (right[1] ?? 0),
          (inverseValues[2] ?? 0) * (right[0] ?? 0) + (inverseValues[3] ?? 0) * (right[1] ?? 0),
        ]),
      ),
    );
    return true;
  }

  matMaxU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, Math.max);
  }

  matMean(source: WasmMatHandle): Float64Array {
    const totals = this.matSum(source);
    const output = new Float64Array(4);
    const pixels = source.rows * source.columns;
    for (let channel = 0; channel < source.channels; channel += 1) {
      output[channel] = floatAt(totals, channel) / pixels;
    }
    return output;
  }

  matMinU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, Math.min);
  }

  matMinMaxLoc(source: WasmMatHandle): Float64Array {
    const data = source.toUint8Array();
    let minimum = byteAt(data, 0);
    let maximum = minimum;
    let minimumIndex = 0;
    let maximumIndex = 0;
    for (let index = 1; index < data.length; index += 1) {
      const value = byteAt(data, index);
      if (value < minimum) {
        minimum = value;
        minimumIndex = index;
      }
      if (value > maximum) {
        maximum = value;
        maximumIndex = index;
      }
    }
    return new Float64Array([
      minimum,
      maximum,
      minimumIndex % source.columns,
      Math.floor(minimumIndex / source.columns),
      maximumIndex % source.columns,
      Math.floor(maximumIndex / source.columns),
    ]);
  }

  matSubtractU8(left: WasmMatHandle, right: WasmMatHandle): WasmMatHandle {
    return binaryU8(left, right, (leftValue, rightValue) => Math.max(leftValue - rightValue, 0));
  }

  matSum(source: WasmMatHandle): Float64Array {
    const output = new Float64Array(4);
    const data = source.toUint8Array();
    for (let index = 0; index < data.length; index += 1) {
      const channel = index % source.channels;
      output[channel] = floatAt(output, channel) + byteAt(data, index);
    }
    return output;
  }

  matTranspose(source: WasmMatHandle): WasmMatHandle {
    const input = source.toUint8Array();
    const output = new Uint8Array(input.byteLength);
    const pixelBytes = source.channels * depthByteWidth(source.depth);
    for (let row = 0; row < source.columns; row += 1) {
      for (let column = 0; column < source.rows; column += 1) {
        const sourceOffset = (column * source.columns + row) * pixelBytes;
        const outputOffset = (row * source.rows + column) * pixelBytes;
        output.set(input.subarray(sourceOffset, sourceOffset + pixelBytes), outputOffset);
      }
    }
    return new CopyingMatHandle(source.columns, source.rows, source.channels, output, source.depth);
  }

  matTransposeInto(source: WasmMatHandle, destination: WasmMatHandle): void {
    destination.copyFromBytes(this.matTranspose(source).toUint8Array());
  }

  matZerosU8(rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(rows, columns, channels, new Uint8Array(rows * columns * channels));
  }

  matZerosF32(rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(
      rows,
      columns,
      channels,
      new Uint8Array(rows * columns * channels * Float32Array.BYTES_PER_ELEMENT),
      5,
    );
  }

  matTrace(source: WasmMatHandle): number {
    const data = source.toUint8Array();
    const diagonal = Math.min(source.rows, source.columns);
    let total = 0;
    for (let position = 0; position < diagonal; position += 1) {
      const index = (position * source.columns + position) * source.channels;
      total += byteAt(data, index);
    }
    return total;
  }

  matTransform(source: WasmMatHandle, coefficients: WasmMatHandle): WasmMatHandle {
    const input = source.toUint8Array();
    const weights = coefficients.toFloat64Array();
    const output = new Uint8Array(source.rows * source.columns * coefficients.rows);
    for (let pixel = 0; pixel < source.rows * source.columns; pixel += 1) {
      for (let outputChannel = 0; outputChannel < coefficients.rows; outputChannel += 1) {
        let value = 0;
        for (let inputChannel = 0; inputChannel < source.channels; inputChannel += 1) {
          value +=
            (input[pixel * source.channels + inputChannel] ?? 0) *
            (weights[outputChannel * coefficients.columns + inputChannel] ?? 0);
        }
        if (coefficients.columns === source.channels + 1) {
          value += weights[outputChannel * coefficients.columns + source.channels] ?? 0;
        }
        output[pixel * coefficients.rows + outputChannel] = Math.round(value);
      }
    }
    return new CopyingMatHandle(source.rows, source.columns, coefficients.rows, output);
  }

  matTransformInto(
    source: WasmMatHandle,
    coefficients: WasmMatHandle,
    destination: WasmMatHandle,
  ): void {
    destination.copyFromBytes(this.matTransform(source, coefficients).toUint8Array());
  }

  matPerspectiveTransform(source: WasmMatHandle, _coefficients: WasmMatHandle): WasmMatHandle {
    return new CopyingMatHandle(
      source.rows,
      source.columns,
      source.channels,
      source.toUint8Array(),
      source.depth,
    );
  }

  matPerspectiveTransformInto(
    source: WasmMatHandle,
    coefficients: WasmMatHandle,
    destination: WasmMatHandle,
  ): void {
    destination.copyFromBytes(this.matPerspectiveTransform(source, coefficients).toUint8Array());
  }

  matRotate(source: WasmMatHandle, rotateCode: number): WasmMatHandle {
    if (rotateCode === 1) {
      return this.matFlip(source, -1);
    }
    const transposed = this.matTranspose(source);
    return this.matFlip(transposed, rotateCode === 0 ? 1 : 0);
  }

  matRotateInto(source: WasmMatHandle, destination: WasmMatHandle, rotateCode: number): void {
    destination.copyFromBytes(this.matRotate(source, rotateCode).toUint8Array());
  }

  matRepeat(source: WasmMatHandle, rowRepeats: number, columnRepeats: number): WasmMatHandle {
    const input = source.toUint8Array();
    const rows = source.rows * rowRepeats;
    const columns = source.columns * columnRepeats;
    const pixelBytes = source.channels * depthByteWidth(source.depth);
    const output = new Uint8Array(rows * columns * pixelBytes);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const sourceOffset =
          ((row % source.rows) * source.columns + (column % source.columns)) * pixelBytes;
        const outputOffset = (row * columns + column) * pixelBytes;
        output.set(input.subarray(sourceOffset, sourceOffset + pixelBytes), outputOffset);
      }
    }
    return new CopyingMatHandle(rows, columns, source.channels, output, source.depth);
  }

  matRepeatInto(
    source: WasmMatHandle,
    destination: WasmMatHandle,
    rowRepeats: number,
    columnRepeats: number,
  ): void {
    destination.copyFromBytes(this.matRepeat(source, rowRepeats, columnRepeats).toUint8Array());
  }

  matZerosF64(rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(
      rows,
      columns,
      channels,
      new Uint8Array(rows * columns * channels * Float64Array.BYTES_PER_ELEMENT),
      6,
    );
  }

  matZerosI16(rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(
      rows,
      columns,
      channels,
      new Uint8Array(rows * columns * channels * Int16Array.BYTES_PER_ELEMENT),
      3,
    );
  }

  matZerosI32(rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(
      rows,
      columns,
      channels,
      new Uint8Array(rows * columns * channels * Int32Array.BYTES_PER_ELEMENT),
      4,
    );
  }

  matZerosI8(rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(
      rows,
      columns,
      channels,
      new Uint8Array(rows * columns * channels),
      1,
    );
  }

  matZerosU16(rows: number, columns: number, channels: number): WasmMatHandle {
    return new CopyingMatHandle(
      rows,
      columns,
      channels,
      new Uint8Array(rows * columns * channels * Uint16Array.BYTES_PER_ELEMENT),
      2,
    );
  }

  setRNGSeed(seed: number): void {
    this.#randomState = seed;
  }

  setLogLevel(level: number): number {
    const previous = this.#logLevel;
    this.#logLevel = level;
    return previous;
  }

  resizeNearestRgba(
    _data: Uint8Array,
    _width: number,
    _height: number,
    targetWidth: number,
    targetHeight: number,
  ): Uint8Array {
    return new Uint8Array(targetWidth * targetHeight * 4);
  }

  thresholdRgba(data: Uint8Array): Uint8Array {
    return new Uint8Array(data);
  }
}

function binaryU8(
  left: WasmMatHandle,
  right: WasmMatHandle,
  operation: (leftValue: number, rightValue: number) => number,
): WasmMatHandle {
  const leftData = left.toUint8Array();
  const rightData = right.toUint8Array();
  const output = leftData.map((value, index) => operation(value, byteAt(rightData, index)));
  return new CopyingMatHandle(left.rows, left.columns, left.channels, output);
}

function f64Handle(rows: number, columns: number, values: readonly number[]): WasmMatHandle {
  return new CopyingMatHandle(rows, columns, 1, copyViewBytes(new Float64Array(values)), 6);
}

function contourPoints(source: WasmMatHandle): Array<{ readonly x: number; readonly y: number }> {
  const values = source.depth === 4 ? source.toInt32Array() : source.toFloat64Array();
  const points: Array<{ readonly x: number; readonly y: number }> = [];
  for (let index = 0; index < values.length; index += 2) {
    points.push({ x: requiredNumber(values, index), y: requiredNumber(values, index + 1) });
  }
  return points;
}

function requiredPoint(
  points: ReadonlyArray<{ readonly x: number; readonly y: number }>,
  index: number,
): { readonly x: number; readonly y: number } {
  const point = points[index];
  if (point === undefined) throw new RangeError(`missing point at index ${index}`);
  return point;
}

function requiredNumber(values: Int32Array | Float64Array, index: number): number {
  const value = values[index];
  if (value === undefined) throw new RangeError(`missing number at index ${index}`);
  return value;
}

function pointSegmentDistance(
  x: number,
  y: number,
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
): number {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const ratio =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - start.x) * deltaX + (y - start.y) * deltaY) / lengthSquared));
  return Math.hypot(x - (start.x + ratio * deltaX), y - (start.y + ratio * deltaY));
}

function cleanTiny(value: number): number {
  return Math.abs(value) < Number.EPSILON ? 0 : value;
}

function byteAt(data: Uint8Array, index: number): number {
  const value = data[index];
  if (value === undefined) {
    throw new RangeError(`missing byte at index ${index}`);
  }
  return value;
}

function floatAt(data: Float64Array, index: number): number {
  const value = data[index];
  if (value === undefined) {
    throw new RangeError(`missing float at index ${index}`);
  }
  return value;
}

function unaryU8(source: WasmMatHandle, operation: (value: number) => number): WasmMatHandle {
  return new CopyingMatHandle(
    source.rows,
    source.columns,
    source.channels,
    source.toUint8Array().map(operation),
  );
}

describe("createRgbaImage", () => {
  test("copies caller-owned data", () => {
    const input = new Uint8Array([1, 2, 3, 4]);
    const image = createRgbaImage(1, 1, input);
    input[0] = 99;
    expect(image.data).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  test("rejects a mismatched RGBA buffer", () => {
    expect(() => createRgbaImage(2, 1, new Uint8Array(4))).toThrow(OpenCvInputError);
  });
});

describe("OpenCv client", () => {
  const client = createOpenCv(new CopyingBackend());
  const image = createRgbaImage(1, 1, new Uint8Array([1, 2, 3, 255]));

  test("returns validated output", () => {
    expect(client.grayscale(image)).toEqual(image);
    expect(client.invert(image)).toEqual(image);
    expect(client.threshold(image, 127)).toEqual(image);
  });

  test("validates threshold values before calling WASM", () => {
    expect(() => client.threshold(image, 256)).toThrow(OpenCvInputError);
    expect(() => client.threshold(image, 1.5)).toThrow(OpenCvInputError);
  });

  test("uses target dimensions for resized output", () => {
    const resized = client.resizeNearest(image, 2, 3);
    expect(resized.width).toBe(2);
    expect(resized.height).toBe(3);
    expect(resized.data.byteLength).toBe(24);
  });

  test("creates Rust-owned matrix handles and regions", () => {
    const matrix = client.matFromU8(2, 4, 1, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    const region = matrix.roi(0, 1, 2, 2);

    expect(matrix.depth).toBe("u8");
    expect(region.rows).toBe(2);
    expect(region.columns).toBe(2);
    expect(region.toUint8Array()).toEqual(new Uint8Array([2, 3, 6, 7]));

    matrix.dispose();
    expect(() => matrix.rows).toThrow(
      new BindingError("Cannot pass deleted object as a pointer of type Mat const*"),
    );
    expect(region.toUint8Array()).toEqual(new Uint8Array([2, 3, 6, 7]));
    region.dispose();
  });

  test("creates a canonical empty matrix for OutputArray destinations", () => {
    const matrix = client.emptyMat();

    expect(matrix.rows).toBe(0);
    expect(matrix.columns).toBe(0);
    expect(matrix.channels).toBe(1);
    expect(matrix.depth).toBe("u8");
    expect(matrix.byteLength).toBe(0);
    expect(matrix.rowStride).toBe(0);
    expect(matrix.isContinuous).toBe(false);
    expect(matrix.toUint8Array()).toEqual(new Uint8Array());

    matrix.dispose();
    expect(() => matrix.rows).toThrow(
      new BindingError("Cannot pass deleted object as a pointer of type Mat const*"),
    );
  });

  test("allocates zero-filled matrices", () => {
    const matrix = client.zerosU8(2, 3, 4);
    expect(matrix.byteLength).toBe(24);
    expect(matrix.toUint8Array()).toEqual(new Uint8Array(24));
    matrix.dispose();
  });

  test("exposes factories for every scalar matrix depth", () => {
    expect(client).toHaveProperty("matFromI8");
    expect(client).toHaveProperty("matFromU16");
    expect(client).toHaveProperty("matFromI16");
    expect(client).toHaveProperty("matFromI32");
    expect(client).toHaveProperty("matFromF32");
    expect(client).toHaveProperty("matFromF64");

    const signed = client.matFromI16(1, 3, 1, new Int16Array([-32_768, 7, 32_767]));
    expect(signed.depth).toBe("i16");
    expect(signed.toInt16Array()).toEqual(new Int16Array([-32_768, 7, 32_767]));
    signed.dispose();

    const floating = client.zerosF32(2, 2, 1);
    expect(floating.depth).toBe("f32");
    expect(floating.toFloat32Array()).toEqual(new Float32Array(4));
    floating.dispose();
  });

  test("constructs typed empty matrix headers", () => {
    const zeroRows = client.matFromF32(0, 3, 2, new Float32Array());
    expect([zeroRows.rows, zeroRows.columns, zeroRows.channels, zeroRows.depth]).toEqual([
      0,
      3,
      2,
      "f32",
    ]);
    expect(zeroRows.byteLength).toBe(0);

    const zeroColumns = client.matFromF64(2, 0, 3, new Float64Array());
    expect([
      zeroColumns.rows,
      zeroColumns.columns,
      zeroColumns.channels,
      zeroColumns.depth,
    ]).toEqual([2, 0, 3, "f64"]);
    expect(zeroColumns.byteLength).toBe(0);

    zeroColumns.dispose();
    zeroRows.dispose();
  });

  test("initializes matrices and controls deterministic random fills", () => {
    const identity = client.zerosU8(2, 3, 1);
    client.setIdentity(identity);
    expect(identity.toUint8Array()).toEqual(new Uint8Array([1, 0, 0, 0, 1, 0]));

    const first = client.zerosU8(1, 8, 1);
    const second = client.zerosU8(1, 8, 1);
    client.setRNGSeed(42);
    client.randu(first, [10, 0, 0, 0], [20, 0, 0, 0]);
    client.setRNGSeed(42);
    client.randu(second, [10, 0, 0, 0], [20, 0, 0, 0]);
    expect(first.toUint8Array()).toEqual(second.toUint8Array());
    expect(Array.from(first.toUint8Array()).every((value) => value >= 10 && value < 20)).toBeTrue();

    const normal = client.zerosF64(1, 4, 1);
    client.randn(normal, [3, 0, 0, 0], [0, 0, 0, 0]);
    expect(normal.toFloat64Array()).toEqual(new Float64Array([3, 3, 3, 3]));

    expect(() => client.setRNGSeed(2 ** 31)).toThrow(OpenCvInputError);
    for (const matrix of [normal, second, first, identity]) matrix.dispose();
  });

  test("controls logging and computes optimal DFT sizes", () => {
    const initial = client.getLogLevel();
    expect(client.setLogLevel(5)).toBe(initial);
    expect(client.getLogLevel()).toBe(5);
    expect(client.setLogLevel(initial)).toBe(5);
    const backend = new CopyingBackend();
    const localClient = createOpenCv(backend);
    expect(localClient.getOptimalDFTSize.bind(localClient)).toHaveLength(1);
    expect(localClient.getOptimalDFTSize(7)).toBe(8);
    expect(localClient.getOptimalDFTSize(25)).toBe(25);
    expect(localClient.getOptimalDFTSize(-1)).toBe(-1);
    expect(localClient.getOptimalDFTSize(2_125_763_999)).toBe(2_125_764_000);
    expect(localClient.getOptimalDFTSize(2_125_764_000)).toBe(-1);

    // SAFETY: This widens only the plain-JavaScript call surface exercised by the binding audit.
    const javascriptClient = localClient as typeof localClient & {
      getOptimalDFTSize(size?: boolean | number | string | null, extra?: number): number;
    };
    expect(() => javascriptClient.getOptimalDFTSize()).toThrow(
      new BindingError("function getOptimalDFTSize called with 0 arguments, expected 1 args!"),
    );
    expect(() => javascriptClient.getOptimalDFTSize(7, 1)).toThrow(
      new BindingError("function getOptimalDFTSize called with 2 arguments, expected 1 args!"),
    );
    expect(javascriptClient.getOptimalDFTSize(7.9)).toBe(8);
    expect(backend.optimalDftSizeInputs.at(-1)).toBe(7);
    expect(javascriptClient.getOptimalDFTSize(Number.NaN)).toBe(1);
    expect(backend.optimalDftSizeInputs.at(-1)).toBe(0);
    expect(javascriptClient.getOptimalDFTSize(true)).toBe(1);
    expect(backend.optimalDftSizeInputs.at(-1)).toBe(1);

    const callCountBeforeInvalidInputs = backend.optimalDftSizeInputs.length;
    const rejected: ReadonlyArray<readonly [boolean | number | string | null | undefined, string]> =
      [
        [null, 'Cannot convert "null" to int'],
        [undefined, 'Cannot convert "undefined" to int'],
        ["7", 'Cannot convert "7" to int'],
        [
          Number.POSITIVE_INFINITY,
          'Passing a number "Infinity" from JS side to C/C++ side to an argument of type "int", which is outside the valid range [-2147483648, 2147483647]!',
        ],
        [
          2_147_483_648,
          'Passing a number "2147483648" from JS side to C/C++ side to an argument of type "int", which is outside the valid range [-2147483648, 2147483647]!',
        ],
      ];
    for (const [input, message] of rejected) {
      expect(() => javascriptClient.getOptimalDFTSize(input)).toThrow(new TypeError(message));
    }
    expect(backend.optimalDftSizeInputs).toHaveLength(callCountBeforeInvalidInputs);
  });

  test("applies linear and perspective transforms", () => {
    const source = client.matFromU8(1, 2, 1, new Uint8Array([1, 2]));
    const coefficients = client.matFromF64(1, 2, 1, new Float64Array([2, 1]));
    const transformed = client.transform(source, coefficients);
    const transformedDestination = client.zerosU8(1, 2, 1);
    client.transform(source, coefficients, transformedDestination);
    expect(transformed.toUint8Array()).toEqual(new Uint8Array([3, 5]));
    expect(transformedDestination.toUint8Array()).toEqual(new Uint8Array([3, 5]));

    const points = client.matFromF64(1, 2, 2, new Float64Array([1, 2, 3, 4]));
    const identity = client.matFromF64(3, 3, 1, new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
    const projected = client.perspectiveTransform(points, identity);
    const projectedDestination = client.zerosF64(1, 2, 2);
    client.perspectiveTransform(points, identity, projectedDestination);
    expect(projected.toFloat64Array()).toEqual(new Float64Array([1, 2, 3, 4]));
    expect(projectedDestination.toFloat64Array()).toEqual(new Float64Array([1, 2, 3, 4]));

    for (const matrix of [
      projectedDestination,
      projected,
      identity,
      points,
      transformedDestination,
      transformed,
      coefficients,
      source,
    ]) {
      matrix.dispose();
    }
  });

  test("measures contours and classifies polygon points", () => {
    const contour = client.matFromI32(4, 1, 2, new Int32Array([0, 0, 4, 0, 4, 3, 0, 3]));

    expect(client.arcLength(contour, false)).toBe(11);
    expect(client.arcLength(contour, true)).toBe(14);
    expect(client.contourArea(contour)).toBe(12);
    expect(client.boundingRect(contour)).toEqual({ x: 0, y: 0, width: 5, height: 4 });
    expect(client.isContourConvex(contour)).toBeTrue();
    expect(client.pointPolygonTest(contour, { x: 2, y: 1 }, true)).toBe(1);

    contour.dispose();
  });

  test("matches contour measurement call contracts", () => {
    const contour = client.matFromI32(4, 1, 2, new Int32Array([0, 0, 4, 0, 4, 3, 0, 3]));

    expect(client.arcLength.length).toBe(2);
    expect(client.contourArea.length).toBe(0);
    expect(client.boundingRect.length).toBe(1);
    // @ts-expect-error Runtime parity uses JavaScript boolean coercion.
    expect(client.arcLength(contour, "closed")).toBe(14);
    // @ts-expect-error Runtime parity uses JavaScript boolean coercion.
    expect(client.contourArea(contour, 0)).toBe(12);
    // @ts-expect-error Runtime parity rejects missing arguments.
    expect(() => client.arcLength(contour)).toThrow(BindingError);
    // @ts-expect-error Runtime parity rejects extra arguments.
    expect(() => client.boundingRect(contour, 1)).toThrow(BindingError);

    contour.dispose();
  });

  test("matches polygon query call contracts", () => {
    type JavascriptBindingValue =
      boolean | number | bigint | string | symbol | object | null | undefined;
    const backend = new CopyingBackend();
    const localClient = createOpenCv(backend);
    const contour = localClient.matFromI32(4, 1, 2, new Int32Array([0, 0, 4, 0, 4, 3, 0, 3]));
    // SAFETY: This widens only the plain-JavaScript call shapes exercised by the binding audit.
    const javascriptClient = localClient as typeof localClient & {
      isContourConvex(contour?: JavascriptBindingValue, extra?: JavascriptBindingValue): boolean;
      pointPolygonTest(
        contour?: JavascriptBindingValue,
        point?: JavascriptBindingValue,
        measureDistance?: JavascriptBindingValue,
        extra?: JavascriptBindingValue,
      ): number;
    };

    expect(localClient.isContourConvex.length).toBe(1);
    expect(localClient.pointPolygonTest.length).toBe(3);
    expect(() => javascriptClient.isContourConvex()).toThrow(BindingError);
    expect(() => javascriptClient.isContourConvex(contour, 1)).toThrow(BindingError);
    expect(() => javascriptClient.isContourConvex(null)).toThrow(BindingError);
    expect(() => javascriptClient.pointPolygonTest()).toThrow(BindingError);
    expect(() => javascriptClient.pointPolygonTest(contour)).toThrow(BindingError);
    expect(() => javascriptClient.pointPolygonTest(contour, { x: 1, y: 1 })).toThrow(BindingError);
    expect(() => javascriptClient.pointPolygonTest(contour, { x: 1, y: 1 }, false, 1)).toThrow(
      BindingError,
    );
    expect(() => javascriptClient.pointPolygonTest(null, { x: 1, y: 1 }, false)).toThrow(
      BindingError,
    );

    const propertyReads: string[] = [];
    const point = {
      get x(): number {
        propertyReads.push("x");
        return 16_777_217;
      },
      get y(): boolean {
        propertyReads.push("y");
        return true;
      },
      get ignored(): never {
        throw new Error("point extras must not be read");
      },
    };
    expect(javascriptClient.pointPolygonTest(contour, point, "distance")).toBeLessThan(0);
    expect(propertyReads).toEqual(["x", "y"]);
    expect(backend.pointPolygonTestInputs.at(-1)).toEqual({
      x: Math.fround(16_777_217),
      y: 1,
      measureDistance: true,
    });

    const missingFieldReads: string[] = [];
    const missingY = {
      get x(): number {
        missingFieldReads.push("x");
        return 1;
      },
    };
    expect(() => javascriptClient.pointPolygonTest(contour, missingY, false)).toThrow(BindingError);
    expect(missingFieldReads).toEqual([]);

    const arrayWithFields = Object.assign([], { x: 2, y: 1.5 });
    const functionWithFields = Object.assign(() => undefined, { x: 2, y: 1.5 });
    expect(javascriptClient.pointPolygonTest(contour, arrayWithFields, false)).toBe(1);
    expect(javascriptClient.pointPolygonTest(contour, functionWithFields, false)).toBe(1);

    expect(
      javascriptClient.pointPolygonTest(
        contour,
        { x: Number.NaN, y: Number.POSITIVE_INFINITY },
        0n,
      ),
    ).toBe(-1);
    const nonFiniteInput = backend.pointPolygonTestInputs.at(-1);
    expect(nonFiniteInput?.x).toBeNaN();
    expect(nonFiniteInput?.y).toBe(Number.POSITIVE_INFINITY);
    expect(nonFiniteInput?.measureDistance).toBeFalse();

    const boxedNumber: object = Object(1);
    const rejectedPoints: JavascriptBindingValue[] = [
      "point",
      null,
      undefined,
      boxedNumber,
      1n,
      [1, 2],
      {},
      { x: 1 },
      { y: 1 },
    ];
    const rejectedComponents: JavascriptBindingValue[] = [
      "1",
      null,
      undefined,
      boxedNumber,
      1n,
      [],
    ];
    const callCountBeforeRejections = backend.pointPolygonTestInputs.length;
    for (const rejectedPoint of rejectedPoints) {
      expect(() => javascriptClient.pointPolygonTest(contour, rejectedPoint, false)).toThrow();
    }
    for (const rejectedComponent of rejectedComponents) {
      expect(() =>
        javascriptClient.pointPolygonTest(contour, { x: rejectedComponent, y: 1 }, false),
      ).toThrow();
      expect(() =>
        javascriptClient.pointPolygonTest(contour, { x: 1, y: rejectedComponent }, false),
      ).toThrow();
    }
    expect(backend.pointPolygonTestInputs).toHaveLength(callCountBeforeRejections);

    contour.dispose();
  });

  test("creates image-processing helpers with structured point results", () => {
    const kernel = client.getStructuringElement(1, { width: 3, height: 3 }, { x: 1, y: 1 });
    expect(kernel.toUint8Array()).toEqual(new Uint8Array([0, 1, 0, 1, 1, 1, 0, 1, 0]));

    const window = client.createHanningWindow({ width: 3, height: 3 }, "f64");
    expect(window.toFloat64Array()).toEqual(new Float64Array([0, 0, 0, 0, 1, 0, 0, 0, 0]));

    expect(client.ellipse2Poly({ x: 0, y: 0 }, { width: 10, height: 5 }, 0, 0, 90, 90)).toEqual([
      { x: 10, y: 0 },
      { x: 0, y: 5 },
    ]);
    expect(
      client.clipLine({ x: 10, y: 20, width: 5, height: 4 }, { x: 8, y: 21 }, { x: 16, y: 21 }),
    ).toEqual([
      { x: 10, y: 21 },
      { x: 14, y: 21 },
    ]);
    expect(
      client.clipLine({ x: 10, y: 20, width: 5, height: 4 }, { x: 0, y: 0 }, { x: 1, y: 1 }),
    ).toBeUndefined();
    expect(() => client.createHanningWindow({ width: 1, height: 3 }, "f32")).toThrow(
      OpenCvInputError,
    );

    window.dispose();
    kernel.dispose();
  });

  test("constructs affine and perspective matrices", () => {
    const rotation = client.getRotationMatrix2D({ x: 1, y: 2 }, 90, 1);
    expect(Array.from(rotation.toFloat64Array())).toEqual([
      6.123_233_995_736_766e-17, 1, -1, -1, 6.123_233_995_736_766e-17, 3,
    ]);

    const affineSource = client.matFromF64(3, 2, 1, new Float64Array([0, 0, 1, 0, 0, 1]));
    const affineDestination = client.matFromF64(3, 2, 1, new Float64Array([2, 3, 4, 3, 2, 6]));
    const affine = client.getAffineTransform(affineSource, affineDestination);
    expect(Array.from(affine.toFloat64Array())).toEqual([2, 0, 2, 0, 3, 3]);

    const inverse = client.invertAffineTransform(affine);
    expect(Array.from(inverse.toFloat64Array())).toEqual([0.5, 0, -1, 0, 1 / 3, -1]);

    const perspectiveSource = client.matFromF64(
      4,
      2,
      1,
      new Float64Array([0, 0, 1, 0, 1, 1, 0, 1]),
    );
    const perspectiveDestination = client.matFromF64(
      4,
      2,
      1,
      new Float64Array([2, 3, 4, 3, 4, 6, 2, 6]),
    );
    const perspective = client.getPerspectiveTransform(perspectiveSource, perspectiveDestination);
    expect(Array.from(perspective.toFloat64Array())).toEqual([2, 0, 2, 0, 3, 3, 0, 0, 1]);
    for (const matrix of [
      perspective,
      perspectiveDestination,
      perspectiveSource,
      inverse,
      affine,
      affineDestination,
      affineSource,
      rotation,
    ]) {
      matrix.dispose();
    }
  });

  test("matches getRotationMatrix2D binding contracts", () => {
    type JavascriptBindingValue =
      boolean | number | bigint | string | symbol | object | null | undefined;
    const backend = new CopyingBackend();
    const localClient = createOpenCv(backend);
    // SAFETY: This widens only the plain-JavaScript call shapes exercised by the binding audit.
    const javascriptClient = localClient as typeof localClient & {
      getRotationMatrix2D(
        center?: JavascriptBindingValue,
        angleDegrees?: JavascriptBindingValue,
        scale?: JavascriptBindingValue,
        extra?: JavascriptBindingValue,
      ): Mat;
    };

    expect(localClient.getRotationMatrix2D.length).toBe(3);
    expect(() => javascriptClient.getRotationMatrix2D()).toThrow(
      new BindingError("function getRotationMatrix2D called with 0 arguments, expected 3 args!"),
    );
    expect(() => javascriptClient.getRotationMatrix2D({ x: 1, y: 2 }, 30)).toThrow(
      new BindingError("function getRotationMatrix2D called with 2 arguments, expected 3 args!"),
    );
    const arityReads: string[] = [];
    const unreadCenter = {
      get x(): never {
        arityReads.push("x");
        throw new Error("arity must be checked first");
      },
      y: 2,
    };
    expect(() => javascriptClient.getRotationMatrix2D(unreadCenter, 30, 2, 1)).toThrow(
      new BindingError("function getRotationMatrix2D called with 4 arguments, expected 3 args!"),
    );
    expect(arityReads).toEqual([]);

    const propertyReads: string[] = [];
    const center = {
      get x(): number {
        propertyReads.push("x");
        return 16_777_217;
      },
      get y(): boolean {
        propertyReads.push("y");
        return true;
      },
      get ignored(): never {
        throw new Error("point extras must not be read");
      },
    };
    const first = javascriptClient.getRotationMatrix2D(center, true, false);
    expect(propertyReads).toEqual(["x", "y"]);
    expect(backend.rotationMatrixInputs.at(-1)).toEqual({
      centerX: Math.fround(16_777_217),
      centerY: 1,
      angleDegrees: 1,
      scale: 0,
    });
    expect([first.rows, first.columns, first.channels, first.depth]).toEqual([2, 3, 1, "f64"]);

    const second = javascriptClient.getRotationMatrix2D(
      { x: Number.NaN, y: Number.POSITIVE_INFINITY },
      Number.NEGATIVE_INFINITY,
      Number.NaN,
    );
    const nonFinite = backend.rotationMatrixInputs.at(-1);
    expect(nonFinite?.centerX).toBeNaN();
    expect(nonFinite?.centerY).toBe(Number.POSITIVE_INFINITY);
    expect(nonFinite?.angleDegrees).toBe(Number.NEGATIVE_INFINITY);
    expect(nonFinite?.scale).toBeNaN();

    const signedZero = javascriptClient.getRotationMatrix2D({ x: -0, y: -0 }, -0, -0);
    const signedZeroInput = backend.rotationMatrixInputs.at(-1);
    expect(Object.is(signedZeroInput?.centerX, -0)).toBeTrue();
    expect(Object.is(signedZeroInput?.centerY, -0)).toBeTrue();
    expect(Object.is(signedZeroInput?.angleDegrees, -0)).toBeTrue();
    expect(Object.is(signedZeroInput?.scale, -0)).toBeTrue();

    expect(() => javascriptClient.getRotationMatrix2D({ x: 1, y: 2 }, "30", 2)).toThrow(
      new TypeError('Cannot convert "30" to double'),
    );
    expect(() => javascriptClient.getRotationMatrix2D({ x: "1", y: 2 }, 30, 2)).toThrow(
      new TypeError('Cannot convert "1" to float'),
    );
    expect(() => javascriptClient.getRotationMatrix2D({ x: 1 }, 30, 2)).toThrow(BindingError);

    first.dispose();
    second.dispose();
    signedZero.dispose();
  });

  test("computes determinants, inverses, and linear solves", () => {
    const coefficients = client.matFromF64(2, 2, 1, new Float64Array([4, 7, 2, 6]));
    expect(client.determinant(coefficients)).toBeCloseTo(10);

    const inverse = client.zerosF64(2, 2, 1);
    expect(client.invert(coefficients, inverse)).toBe(1);
    expect(Array.from(inverse.toFloat64Array())).toEqual([0.6, -0.7, -0.2, 0.4]);

    const rightHandSide = client.matFromF64(2, 1, 1, new Float64Array([1, 0]));
    const solution = client.zerosF64(2, 1, 1);
    expect(client.solve(coefficients, rightHandSide, solution)).toBeTrue();
    expect(Array.from(solution.toFloat64Array())).toEqual([0.6, -0.2]);

    for (const matrix of [solution, rightHandSide, inverse, coefficients]) matrix.dispose();
  });

  test("matches determinant call and Mat binding contracts", () => {
    type JavascriptBindingValue =
      boolean | number | bigint | string | symbol | object | null | undefined;
    const backend = new CopyingBackend();
    const localClient = createOpenCv(backend);
    const source = localClient.matFromF64(2, 2, 1, new Float64Array([1, 2, 3, 4]));
    // SAFETY: This widens only the plain-JavaScript call shapes exercised by the binding audit.
    const javascriptClient = localClient as typeof localClient & {
      determinant(source?: JavascriptBindingValue, extra?: JavascriptBindingValue): number;
    };

    expect(localClient.determinant.length).toBe(1);
    const sourceBefore = source.toFloat64Array();
    expect(localClient.determinant(source)).toBe(-2);
    expect(source.toFloat64Array()).toEqual(sourceBefore);
    expect(() => javascriptClient.determinant()).toThrow(BindingError);
    expect(() => javascriptClient.determinant(source, 1)).toThrow(BindingError);
    expect(() => javascriptClient.determinant(null)).toThrow(
      new BindingError("null is not a valid Mat"),
    );
    expect(() => javascriptClient.determinant({})).toThrow(BindingError);

    source.dispose();
    expect(() => localClient.determinant(source)).toThrow(
      new BindingError("Cannot pass deleted object as a pointer of type Mat"),
    );
  });

  test("exposes matrix-based core operations", () => {
    expect(client).toHaveProperty("add");
    expect(client).toHaveProperty("subtract");
    expect(client).toHaveProperty("absdiff");
    expect(client).toHaveProperty("bitwiseAnd");
    expect(client).toHaveProperty("bitwiseOr");
    expect(client).toHaveProperty("bitwiseXor");
    expect(client).toHaveProperty("bitwiseNot");
    expect(client).toHaveProperty("min");
    expect(client).toHaveProperty("max");
    expect(client).toHaveProperty("compareEqual");
    expect(client).toHaveProperty("inRange");
    expect(client).toHaveProperty("countNonZero");

    const left = client.matFromU8(1, 3, 1, new Uint8Array([250, 2, 3]));
    const right = client.matFromU8(1, 3, 1, new Uint8Array([10, 5, 3]));
    const added = client.add(left, right);
    const subtracted = client.subtract(left, right);
    const difference = client.absdiff(left, right);
    const equal = client.compareEqual(left, right);
    const inverted = client.bitwiseNot(left);

    expect(added.toUint8Array()).toEqual(new Uint8Array([255, 7, 6]));
    expect(subtracted.toUint8Array()).toEqual(new Uint8Array([240, 0, 0]));
    expect(difference.toUint8Array()).toEqual(new Uint8Array([240, 3, 0]));
    expect(equal.toUint8Array()).toEqual(new Uint8Array([0, 0, 255]));
    expect(inverted.toUint8Array()).toEqual(new Uint8Array([5, 253, 252]));
    expect(client.countNonZero(left)).toBe(3);

    for (const matrix of [added, subtracted, difference, equal, inverted, left, right]) {
      matrix.dispose();
    }
  });

  test("matches the exact one-argument countNonZero call contract", () => {
    const source = client.matFromU8(2, 3, 1, new Uint8Array([0, 1, 2, 0, 3, 0]));

    expect(client.countNonZero.length).toBe(1);
    expect(() => {
      // @ts-expect-error Runtime parity requires testing missing arguments from plain JavaScript.
      client.countNonZero();
    }).toThrow(new BindingError("function countNonZero called with 0 arguments, expected 1 args!"));
    expect(client.countNonZero(source)).toBe(3);
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an extra argument from plain JavaScript.
      client.countNonZero(source, 1);
    }).toThrow(new BindingError("function countNonZero called with 2 arguments, expected 1 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a null Mat from plain JavaScript.
      client.countNonZero(null);
    }).toThrow(new BindingError("null is not a valid Mat"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an undefined Mat from plain JavaScript.
      client.countNonZero(undefined);
    }).toThrow(new TypeError("Cannot read properties of undefined (reading '$$')"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a structural object from plain JavaScript.
      client.countNonZero({});
    }).toThrow(new BindingError('Cannot pass "[object Object]" as a Mat'));

    source.dispose();
    expect(() => client.countNonZero(source)).toThrow(
      new BindingError("Cannot pass deleted object as a pointer of type Mat"),
    );
  });

  test("exposes matrix layout operations", () => {
    expect(client).toHaveProperty("flip");
    expect(client).toHaveProperty("transpose");
    expect(client).toHaveProperty("rotate");
    expect(client).toHaveProperty("repeat");

    const source = client.matFromU8(2, 3, 1, new Uint8Array([1, 2, 3, 4, 5, 6]));
    const horizontal = client.flipAlloc(source, 1);
    const transposed = client.transposeAlloc(source);
    const clockwise = client.rotateAlloc(source, 0);
    const repeated = client.repeatAlloc(source, 2, 1);
    const flippedDestination = client.zerosU8(2, 3, 1);
    const transposedDestination = client.zerosU8(3, 2, 1);
    const rotatedDestination = client.zerosU8(3, 2, 1);
    const repeatedDestination = client.zerosU8(4, 3, 1);
    client.flip(source, flippedDestination, 1);
    expect(client.transpose(source, transposedDestination)).toBeUndefined();
    client.rotate(source, rotatedDestination, 0);
    client.repeat(source, 2, 1, repeatedDestination);
    expect(horizontal.toUint8Array()).toEqual(new Uint8Array([3, 2, 1, 6, 5, 4]));
    expect(transposed.rows).toBe(3);
    expect(transposed.columns).toBe(2);
    expect(transposed.toUint8Array()).toEqual(new Uint8Array([1, 4, 2, 5, 3, 6]));
    expect(clockwise.rows).toBe(3);
    expect(clockwise.columns).toBe(2);
    expect(clockwise.toUint8Array()).toEqual(new Uint8Array([4, 1, 5, 2, 6, 3]));
    expect(repeated.rows).toBe(4);
    expect(repeated.toUint8Array()).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6]));
    expect(flippedDestination.toUint8Array()).toEqual(new Uint8Array([3, 2, 1, 6, 5, 4]));
    expect(transposedDestination.toUint8Array()).toEqual(new Uint8Array([1, 4, 2, 5, 3, 6]));
    expect(rotatedDestination.toUint8Array()).toEqual(new Uint8Array([4, 1, 5, 2, 6, 3]));
    expect(repeatedDestination.toUint8Array()).toEqual(
      new Uint8Array([1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6]),
    );
    repeatedDestination.dispose();
    rotatedDestination.dispose();
    transposedDestination.dispose();
    flippedDestination.dispose();
    repeated.dispose();
    clockwise.dispose();
    transposed.dispose();
    horizontal.dispose();
    source.dispose();
  });

  test("matches the exact two-argument transpose call contract", () => {
    const source = client.matFromU8(2, 1, 1, new Uint8Array([1, 2]));
    const destination = client.zerosU8(1, 2, 1);

    expect(client.transpose.length).toBe(2);
    expect(() => {
      // @ts-expect-error Runtime parity requires testing missing arguments from plain JavaScript.
      client.transpose();
    }).toThrow(new BindingError("function transpose called with 0 arguments, expected 2 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a missing destination from plain JavaScript.
      client.transpose(source);
    }).toThrow(new BindingError("function transpose called with 1 arguments, expected 2 args!"));
    expect(client.transpose(source, destination)).toBeUndefined();
    expect(destination.toUint8Array()).toEqual(new Uint8Array([1, 2]));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an extra argument from plain JavaScript.
      client.transpose(source, destination, 1);
    }).toThrow(new BindingError("function transpose called with 3 arguments, expected 2 args!"));

    destination.dispose();
    source.dispose();
  });

  test("matches the exact three-argument flip call contract", () => {
    const source = client.matFromU8(2, 3, 1, new Uint8Array([1, 2, 3, 4, 5, 6]));
    const destination = client.zerosU8(2, 3, 1);

    expect(client.flip.length).toBe(3);
    expect(() => {
      // @ts-expect-error Runtime parity requires testing missing arguments from plain JavaScript.
      client.flip();
    }).toThrow(new BindingError("function flip called with 0 arguments, expected 3 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a missing destination and code.
      client.flip(source);
    }).toThrow(new BindingError("function flip called with 1 arguments, expected 3 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a missing code.
      client.flip(source, destination);
    }).toThrow(new BindingError("function flip called with 2 arguments, expected 3 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an extra argument.
      client.flip(source, destination, 1, 2);
    }).toThrow(new BindingError("function flip called with 4 arguments, expected 3 args!"));

    expect(client.flip(source, destination, 2)).toBeUndefined();
    expect(destination.toUint8Array()).toEqual(new Uint8Array([3, 2, 1, 6, 5, 4]));
    expect(client.flip(source, destination, -2)).toBeUndefined();
    expect(destination.toUint8Array()).toEqual(new Uint8Array([6, 5, 4, 3, 2, 1]));
    expect(client.flip(source, destination, Number.NaN)).toBeUndefined();
    expect(destination.toUint8Array()).toEqual(new Uint8Array([4, 5, 6, 1, 2, 3]));
    expect(() => client.flip(source, destination, 2_147_483_648)).toThrow(
      new TypeError(
        'Passing a number "2147483648" from JS side to C/C++ side to an argument of type "int", which is outside the valid range [-2147483648, 2147483647]!',
      ),
    );
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a null Mat from plain JavaScript.
      client.flip(null, destination, 1);
    }).toThrow(new BindingError("null is not a valid Mat"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an undefined Mat from plain JavaScript.
      client.flip(undefined, destination, 1);
    }).toThrow(new TypeError("Cannot read properties of undefined (reading '$$')"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a structural object from plain JavaScript.
      client.flip({}, destination, 1);
    }).toThrow(new BindingError('Cannot pass "[object Object]" as a Mat'));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a null destination from plain JavaScript.
      client.flip(source, null, 1);
    }).toThrow(new BindingError("null is not a valid Mat"));

    destination.dispose();
    source.dispose();
  });

  test("matches the exact four-argument repeat call contract", () => {
    const source = client.matFromU8(1, 2, 1, new Uint8Array([1, 2]));
    const destination = client.zerosU8(2, 4, 1);

    expect(client.repeat.length).toBe(4);
    expect(() => {
      // @ts-expect-error Runtime parity requires testing missing arguments from plain JavaScript.
      client.repeat();
    }).toThrow(new BindingError("function repeat called with 0 arguments, expected 4 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing missing arguments from plain JavaScript.
      client.repeat(source);
    }).toThrow(new BindingError("function repeat called with 1 arguments, expected 4 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing missing arguments from plain JavaScript.
      client.repeat(source, 1);
    }).toThrow(new BindingError("function repeat called with 2 arguments, expected 4 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a missing destination from plain JavaScript.
      client.repeat(source, 1, 2);
    }).toThrow(new BindingError("function repeat called with 3 arguments, expected 4 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an extra argument from plain JavaScript.
      client.repeat(source, 1, 2, destination, 5);
    }).toThrow(new BindingError("function repeat called with 5 arguments, expected 4 args!"));
    expect(client.repeat(source, 2, 2, destination)).toBeUndefined();
    expect(destination.toUint8Array()).toEqual(new Uint8Array([1, 2, 1, 2, 1, 2, 1, 2]));

    const fractionalDestination = client.zerosU8(1, 4, 1);
    expect(client.repeat(source, 1.9, 2.9, fractionalDestination)).toBeUndefined();
    expect(fractionalDestination.toUint8Array()).toEqual(new Uint8Array([1, 2, 1, 2]));

    const booleanDestination = client.zerosU8(1, 2, 1);
    expect(() => {
      // @ts-expect-error Runtime parity requires boolean-to-int conversion from plain JavaScript.
      client.repeat(source, true, true, booleanDestination);
    }).not.toThrow();
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a null Mat from plain JavaScript.
      client.repeat(null, 1, 1, destination);
    }).toThrow(new BindingError("null is not a valid Mat"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an undefined Mat from plain JavaScript.
      client.repeat(undefined, 1, 1, destination);
    }).toThrow(new TypeError("Cannot read properties of undefined (reading '$$')"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a structural Mat from plain JavaScript.
      client.repeat({}, 1, 1, destination);
    }).toThrow(new BindingError('Cannot pass "[object Object]" as a Mat'));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a null destination from plain JavaScript.
      client.repeat(source, 1, 1, null);
    }).toThrow(new BindingError("null is not a valid Mat"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an invalid repeat count.
      client.repeat(source, "1", 1, destination);
    }).toThrow(new TypeError('Cannot convert "1" to int'));
    expect(() => client.repeat(source, 2_147_483_648, 1, destination)).toThrow(
      new TypeError(
        'Passing a number "2147483648" from JS side to C/C++ side to an argument of type "int", which is outside the valid range [-2147483648, 2147483647]!',
      ),
    );

    const deleted = client.matFromU8(1, 1, 1, new Uint8Array([1]));
    deleted.dispose();
    expect(() => client.repeat(deleted, 1, 1, destination)).toThrow(
      new BindingError("Cannot pass deleted object as a pointer of type Mat"),
    );

    booleanDestination.dispose();
    fractionalDestination.dispose();
    destination.dispose();
    source.dispose();
  });

  test("matches the exact three-argument rotate call contract", () => {
    const source = client.matFromU8(2, 3, 1, new Uint8Array([1, 2, 3, 4, 5, 6]));
    const destination = client.zerosU8(3, 2, 1);

    expect(client.ROTATE_90_CLOCKWISE).toBe(0);
    expect(client.ROTATE_180).toBe(1);
    expect(client.ROTATE_90_COUNTERCLOCKWISE).toBe(2);
    expect(client.rotate.length).toBe(3);
    expect(() => {
      // @ts-expect-error Runtime parity requires testing missing arguments from plain JavaScript.
      client.rotate();
    }).toThrow(new BindingError("function rotate called with 0 arguments, expected 3 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing missing arguments from plain JavaScript.
      client.rotate(source);
    }).toThrow(new BindingError("function rotate called with 1 arguments, expected 3 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a missing code from plain JavaScript.
      client.rotate(source, destination);
    }).toThrow(new BindingError("function rotate called with 2 arguments, expected 3 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an extra argument from plain JavaScript.
      client.rotate(source, destination, 0, 1);
    }).toThrow(new BindingError("function rotate called with 4 arguments, expected 3 args!"));
    expect(client.rotate(source, destination, 0.9)).toBeUndefined();
    expect(destination.toUint8Array()).toEqual(new Uint8Array([4, 1, 5, 2, 6, 3]));

    destination.dispose();
    source.dispose();
  });

  test("matches transpose errors for deleted matrices", () => {
    const deletedSource = client.matFromU8(1, 1, 1, new Uint8Array([7]));
    const liveDestination = client.emptyMat();
    deletedSource.dispose();

    expect(() => client.transpose(deletedSource, liveDestination)).toThrow(
      new BindingError("Cannot pass deleted object as a pointer of type Mat"),
    );
    expect(() => deletedSource.rows).toThrow(
      new BindingError("Cannot pass deleted object as a pointer of type Mat const*"),
    );

    const liveSource = client.matFromU8(1, 1, 1, new Uint8Array([8]));
    const deletedDestination = client.emptyMat();
    deletedDestination.dispose();
    expect(() => client.transpose(liveSource, deletedDestination)).toThrow(
      new BindingError("Cannot pass deleted object as a pointer of type Mat"),
    );

    liveSource.dispose();
    liveDestination.dispose();
  });

  test("exposes typed matrix reductions", () => {
    expect(client).toHaveProperty("sum");
    expect(client).toHaveProperty("mean");
    expect(client).toHaveProperty("minMaxLoc");
    expect(client).toHaveProperty("trace");

    const source = client.matFromU8(1, 2, 3, new Uint8Array([1, 10, 100, 3, 30, 200]));
    expect(client.sum(source)).toEqual([4, 40, 300, 0]);
    expect(client.mean(source)).toEqual([2, 20, 150, 0]);
    source.dispose();

    const extremaSource = client.matFromU8(2, 3, 1, new Uint8Array([5, 2, 9, 2, 9, 4]));
    expect(client.minMaxLoc(extremaSource)).toEqual({
      maxLoc: { x: 2, y: 0 },
      maxVal: 9,
      minLoc: { x: 1, y: 0 },
      minVal: 2,
    });
    expect(client.trace(extremaSource)).toBe(14);
    extremaSource.dispose();
  });

  test("mutates shared matrix destinations", () => {
    const matrix = client.matFromU8(2, 3, 1, new Uint8Array([1, 2, 3, 4, 5, 6]));
    matrix.copyFromBytes(new Uint8Array([6, 5, 4, 3, 2, 1]));
    expect(matrix.toUint8Array()).toEqual(new Uint8Array([6, 5, 4, 3, 2, 1]));
    expect(() => matrix.copyFromBytes(new Uint8Array([1]))).toThrow(OpenCvInputError);
    matrix.dispose();
  });

  test("splits, merges, extracts, and inserts channels", () => {
    const source = client.matFromU8(1, 2, 3, new Uint8Array([1, 10, 100, 2, 20, 200]));
    const planes = client.split(source);
    expect(planes.map((plane) => plane.toUint8Array())).toEqual([
      new Uint8Array([1, 2]),
      new Uint8Array([10, 20]),
      new Uint8Array([100, 200]),
    ]);
    const merged = client.merge([planes[0]!, planes[1]!, planes[2]!]);
    expect(merged.toUint8Array()).toEqual(source.toUint8Array());
    const extracted = client.extractChannel(source, 1);
    expect(extracted.toUint8Array()).toEqual(new Uint8Array([10, 20]));
    const destination = client.zerosU8(1, 2, 3);
    client.insertChannel(extracted, destination, 2);
    expect(destination.toUint8Array()).toEqual(new Uint8Array([0, 0, 10, 0, 0, 20]));
    const routed = client.matFromU8(1, 2, 3, new Uint8Array([7, 8, 9, 70, 80, 90]));
    client.mixChannels(source, routed, new Uint16Array([2, 0, 0, 2]));
    expect(routed.toUint8Array()).toEqual(new Uint8Array([100, 8, 1, 200, 80, 2]));
    routed.dispose();
    destination.dispose();
    extracted.dispose();
    merged.dispose();
    for (const plane of planes) plane.dispose();
    source.dispose();
  });

  test("runs floating-point math and cartesian conversions", () => {
    const x = client.matFromF32(1, 2, 1, new Float32Array([3, 0]));
    const y = client.matFromF32(1, 2, 1, new Float32Array([4, 2]));
    const exponential = client.expAlloc(x);
    const logarithm = client.logAlloc(exponential);
    const squareRoot = client.sqrtAlloc(y);
    const squared = client.powAlloc(x, 2);
    const vectorLength = client.magnitudeAlloc(x, y);
    expect(Array.from(exponential.toFloat32Array())).toEqual([Math.fround(Math.exp(3)), 1]);
    expect(Array.from(logarithm.toFloat32Array())[0]).toBeCloseTo(3, 5);
    expect(Array.from(squareRoot.toFloat32Array())).toEqual([2, Math.fround(Math.sqrt(2))]);
    expect(Array.from(squared.toFloat32Array())).toEqual([9, 0]);
    expect(Array.from(vectorLength.toFloat32Array())).toEqual([5, 2]);

    const lengths = client.zerosF32(1, 2, 1);
    const angles = client.zerosF32(1, 2, 1);
    client.cartToPolar(x, y, lengths, angles);
    const roundTripX = client.zerosF32(1, 2, 1);
    const roundTripY = client.zerosF32(1, 2, 1);
    client.polarToCart(lengths, angles, roundTripX, roundTripY);
    expect(Array.from(roundTripX.toFloat32Array())[0]).toBeCloseTo(3, 5);
    expect(Array.from(roundTripY.toFloat32Array())[0]).toBeCloseTo(4, 5);

    for (const matrix of [
      roundTripY,
      roundTripX,
      angles,
      lengths,
      vectorLength,
      squared,
      squareRoot,
      exponential,
      logarithm,
      y,
      x,
    ])
      matrix.dispose();
  });

  test("matches float-math destination call contracts", () => {
    const source = client.matFromF32(1, 2, 1, new Float32Array([1, 4]));
    const other = client.matFromF32(1, 2, 1, new Float32Array([2, 3]));
    const destination = client.zerosF32(1, 2, 1);

    expect(client.exp.length).toBe(2);
    expect(client.log.length).toBe(2);
    expect(client.sqrt.length).toBe(2);
    expect(client.pow.length).toBe(3);
    expect(client.magnitude.length).toBe(3);

    expect(() => {
      // @ts-expect-error Runtime parity requires testing missing arguments from plain JavaScript.
      client.exp();
    }).toThrow(new BindingError("function exp called with 0 arguments, expected 2 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a missing destination.
      client.log(source);
    }).toThrow(new BindingError("function log called with 1 arguments, expected 2 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an extra argument.
      client.sqrt(source, destination, destination);
    }).toThrow(new BindingError("function sqrt called with 3 arguments, expected 2 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing missing arguments from plain JavaScript.
      client.pow();
    }).toThrow(new BindingError("function pow called with 0 arguments, expected 3 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a missing destination.
      client.pow(source, 2);
    }).toThrow(new BindingError("function pow called with 2 arguments, expected 3 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an extra argument.
      client.pow(source, 2, destination, destination);
    }).toThrow(new BindingError("function pow called with 4 arguments, expected 3 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing missing arguments from plain JavaScript.
      client.magnitude();
    }).toThrow(new BindingError("function magnitude called with 0 arguments, expected 3 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a missing destination.
      client.magnitude(source, other);
    }).toThrow(new BindingError("function magnitude called with 2 arguments, expected 3 args!"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an extra argument.
      client.magnitude(source, other, destination, destination);
    }).toThrow(new BindingError("function magnitude called with 4 arguments, expected 3 args!"));

    expect(client.exp(source, destination)).toBeUndefined();
    expect(client.log(source, destination)).toBeUndefined();
    expect(client.sqrt(source, destination)).toBeUndefined();
    expect(client.pow(source, 2, destination)).toBeUndefined();
    expect(client.magnitude(source, other, destination)).toBeUndefined();
    expect(() => {
      // @ts-expect-error Runtime parity requires boolean-to-double conversion.
      client.pow(source, true, destination);
    }).not.toThrow();
    expect(() => {
      // @ts-expect-error Runtime parity requires testing Embind double rejection.
      client.pow(source, "2", destination);
    }).toThrow(new TypeError('Cannot convert "2" to double'));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a null Mat.
      client.exp(null, destination);
    }).toThrow(new BindingError("null is not a valid Mat"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an undefined Mat.
      client.log(undefined, destination);
    }).toThrow(new TypeError("Cannot read properties of undefined (reading '$$')"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a structural Mat.
      client.sqrt({}, destination);
    }).toThrow(new BindingError('Cannot pass "[object Object]" as a Mat'));

    const deleted = client.matFromF32(1, 1, 1, new Float32Array([1]));
    deleted.dispose();
    expect(() => {
      // @ts-expect-error Source conversion must fail before power conversion.
      client.pow(deleted, "bad", destination);
    }).toThrow(new BindingError("Cannot pass deleted object as a pointer of type Mat"));
    expect(() => {
      // @ts-expect-error Power conversion must fail before destination conversion.
      client.pow(source, "bad", null);
    }).toThrow(new TypeError('Cannot convert "bad" to double'));

    destination.dispose();
    other.dispose();
    source.dispose();
  });

  test("matches coordinate-conversion overloads and boolean coercion", () => {
    const backend = new CopyingBackend();
    const localClient = createOpenCv(backend);
    const first = localClient.matFromF32(1, 1, 1, new Float32Array([1]));
    const second = localClient.matFromF32(1, 1, 1, new Float32Array([0]));
    const firstOutput = localClient.zerosF32(1, 1, 1);
    const secondOutput = localClient.zerosF32(1, 1, 1);

    expect(localClient.cartToPolar.length).toBe(0);
    expect(localClient.polarToCart.length).toBe(0);
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a missing output.
      localClient.cartToPolar(first, second, firstOutput);
    }).toThrow(BindingError);
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an extra argument.
      localClient.cartToPolar(first, second, firstOutput, secondOutput, true, 1);
    }).toThrow(BindingError);
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a missing output.
      localClient.polarToCart(first, second, firstOutput);
    }).toThrow(BindingError);
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an extra argument.
      localClient.polarToCart(first, second, firstOutput, secondOutput, true, 1);
    }).toThrow(BindingError);
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a null Mat.
      localClient.cartToPolar(null, second, firstOutput, secondOutput);
    }).toThrow(new BindingError("null is not a valid Mat"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing an undefined Mat.
      localClient.polarToCart(first, undefined, firstOutput, secondOutput);
    }).toThrow(new TypeError("Cannot read properties of undefined (reading '$$')"));
    expect(() => {
      // @ts-expect-error Runtime parity requires testing a structural Mat.
      localClient.cartToPolar(first, second, {}, secondOutput);
    }).toThrow(new BindingError('Cannot pass "[object Object]" as a Mat'));

    localClient.cartToPolar(first, second, firstOutput, secondOutput);
    // @ts-expect-error Runtime parity requires JavaScript boolean coercion.
    localClient.cartToPolar(first, second, firstOutput, secondOutput, "degrees");
    localClient.polarToCart(first, second, firstOutput, secondOutput);
    // @ts-expect-error Runtime parity requires JavaScript boolean coercion.
    localClient.polarToCart(first, second, firstOutput, secondOutput, 0);
    expect(backend.cartToPolarDegreeFlags).toEqual([false, true]);
    expect(backend.polarToCartDegreeFlags).toEqual([false, false]);

    secondOutput.dispose();
    firstOutput.dispose();
    second.dispose();
    first.dispose();
  });

  test("concatenates matrices in both axes", () => {
    const left = client.matFromU8(2, 1, 1, new Uint8Array([1, 2]));
    const right = client.matFromU8(2, 2, 1, new Uint8Array([3, 4, 5, 6]));
    const horizontal = client.hconcat([left, right]);
    expect(horizontal.rows).toBe(2);
    expect(horizontal.columns).toBe(3);
    expect(horizontal.toUint8Array()).toEqual(new Uint8Array([1, 3, 4, 2, 5, 6]));

    const top = client.matFromU8(1, 2, 1, new Uint8Array([7, 8]));
    const bottom = client.matFromU8(2, 2, 1, new Uint8Array([9, 10, 11, 12]));
    const vertical = client.vconcat([top, bottom]);
    expect(vertical.rows).toBe(3);
    expect(vertical.columns).toBe(2);
    expect(vertical.toUint8Array()).toEqual(new Uint8Array([7, 8, 9, 10, 11, 12]));
    for (const matrix of [vertical, bottom, top, horizontal, right, left]) matrix.dispose();
  });

  test("runs scaled all-depth numeric operations", () => {
    const left = client.matFromU8(1, 3, 1, new Uint8Array([10, 20, 250]));
    const right = client.matFromU8(1, 3, 1, new Uint8Array([2, 0, 2]));
    const product = client.multiplyAlloc(left, right, 0.5);
    const quotient = client.divideAlloc(left, right, 2);
    const blended = client.addWeightedAlloc(left, 0.5, right, 0.5, 1);
    const absolute = client.convertScaleAbsAlloc(left, -1, 5);
    const destination = client.zerosU8(1, 3, 1);
    client.multiply(left, right, destination, 0.5);
    expect(client.multiply.length).toBe(0);
    expect(client.divide.length).toBe(0);
    expect(client.addWeighted.length).toBe(0);
    expect(client.convertScaleAbs.length).toBe(0);
    expect(product.toUint8Array()).toEqual(new Uint8Array([10, 0, 250]));
    expect(quotient.toUint8Array()).toEqual(new Uint8Array([10, 0, 250]));
    expect(blended.toUint8Array()).toEqual(new Uint8Array([7, 11, 127]));
    expect(absolute.toUint8Array()).toEqual(new Uint8Array([5, 15, 245]));
    expect(destination.toUint8Array()).toEqual(product.toUint8Array());
    for (const matrix of [destination, absolute, blended, quotient, product, right, left])
      matrix.dispose();
  });

  test("matches numeric destination overloads and dtype forwarding", () => {
    const backend = new CopyingBackend();
    const localClient = createOpenCv(backend);
    const left = localClient.matFromU8(1, 1, 1, new Uint8Array([6]));
    const right = localClient.matFromU8(1, 1, 1, new Uint8Array([3]));
    const destination = localClient.zerosU8(1, 1, 1);

    localClient.multiply(left, right, destination);
    localClient.multiply(left, right, destination, 0.5, 6);
    localClient.divide(left, right, destination, 2, 5);
    localClient.addWeighted(left, 0.25, right, 0.75, 1, destination, 4);

    expect(backend.numericIntoCalls).toEqual([
      { method: "multiply", scale: 1, dtype: -1 },
      { method: "multiply", scale: 0.5, dtype: 6 },
      { method: "divide", scale: 2, dtype: 5 },
      { method: "addWeighted", scale: 1, dtype: 4 },
    ]);
    // @ts-expect-error Runtime parity rejects missing destination arguments.
    expect(() => localClient.multiply(left, right)).toThrow(BindingError);
    // @ts-expect-error Runtime parity rejects missing destination arguments.
    expect(() => localClient.convertScaleAbs(left)).toThrow(BindingError);
    expect(() => localClient.multiply(left, right, destination, undefined)).toThrow(TypeError);
    expect(() => localClient.divide(left, right, destination, undefined)).toThrow(TypeError);
    expect(() => localClient.addWeighted(left, 1, right, 1, 0, destination, undefined)).toThrow(
      TypeError,
    );
    expect(() => localClient.convertScaleAbs(left, destination, undefined)).toThrow(TypeError);

    destination.dispose();
    right.dispose();
    left.dispose();
  });

  test("adds typed matrix borders", () => {
    const source = client.matFromU8(1, 2, 1, new Uint8Array([7, 8]));
    const bordered = client.copyMakeBorder(source, 1, 1, 1, 1, 0, [9, 0, 0, 0]);
    expect(bordered.rows).toBe(3);
    expect(bordered.columns).toBe(4);
    expect(bordered.toUint8Array()).toEqual(new Uint8Array([9, 9, 9, 9, 9, 7, 8, 9, 9, 9, 9, 9]));
    bordered.dispose();
    source.dispose();
  });

  test("applies a typed lookup table", () => {
    const values = Uint8Array.from({ length: 256 }, (_, value) => value);
    values[1] = 99;
    const table = client.matFromU8(256, 1, 1, values);
    const source = client.matFromU8(1, 3, 1, new Uint8Array([0, 1, 255]));
    const result = client.lut(source, table);
    expect(result.toUint8Array()).toEqual(new Uint8Array([0, 99, 255]));
    const destination = client.zerosU8(1, 3, 1);
    client.lut(source, table, destination);
    expect(destination.toUint8Array()).toEqual(result.toUint8Array());
    destination.dispose();
    result.dispose();
    source.dispose();
    table.dispose();
  });

  test("computes norms and normalizes into destinations", () => {
    const source = client.matFromU8(1, 2, 1, new Uint8Array([3, 4]));
    expect(client.norm(source, 4)).toBe(5);
    const other = client.matFromU8(1, 2, 1, new Uint8Array([0, 0]));
    expect(client.norm(source, other, 2)).toBe(7);
    const destination = client.zerosU8(1, 2, 1);
    client.normalize(source, destination, 10, 0, 4);
    expect(destination.toUint8Array()).toEqual(new Uint8Array([6, 8]));
    destination.dispose();
    other.dispose();
    source.dispose();
  });

  test("writes channel statistics and dimensional reductions", () => {
    const source = client.matFromU8(2, 2, 1, new Uint8Array([1, 3, 5, 7]));
    const means = client.zerosF64(1, 1, 1);
    const deviations = client.zerosF64(1, 1, 1);
    client.meanStdDev(source, means, deviations);
    expect(means.toFloat64Array()[0]).toBe(4);
    expect(deviations.toFloat64Array()[0]).toBeCloseTo(Math.sqrt(5), 12);
    const reduced = client.zerosU8(1, 2, 1);
    client.reduce(source, reduced, 0, 0);
    expect(reduced.toUint8Array()).toEqual(new Uint8Array([6, 10]));
    reduced.dispose();
    deviations.dispose();
    means.dispose();
    source.dispose();
  });

  test("owns AKAZE configuration handles with documented defaults", () => {
    const backend = new CopyingBackend();
    const localClient = createOpenCv(backend);
    const akaze = localClient.createAKAZE();

    expect(akaze.getDefaultName()).toBe("Feature2D.AKAZE");
    expect(akaze.getDescriptorType()).toBe(AKAZE_DescriptorType.DESCRIPTOR_MLDB);
    expect(akaze.getDescriptorSize()).toBe(AKAZE_DEFAULTS.descriptorSize);
    expect(akaze.getDescriptorChannels()).toBe(AKAZE_DEFAULTS.descriptorChannels);
    expect(akaze.getThreshold()).toBeCloseTo(AKAZE_DEFAULTS.threshold, 9);
    expect(akaze.getNOctaves()).toBe(AKAZE_DEFAULTS.octaves);
    expect(akaze.getNOctaveLayers()).toBe(AKAZE_DEFAULTS.octaveLayers);
    expect(akaze.getDiffusivity()).toBe(KAZE_DiffusivityType.DIFF_PM_G2);

    akaze.dispose();
    expect(backend.akazeFreeCount).toBe(1);
    akaze.dispose();
    expect(backend.akazeFreeCount).toBe(1);
    expect(() => akaze.getThreshold()).toThrow(BindingError);
  });

  test("owns an AgastFeatureDetector configuration with OpenCV defaults", () => {
    const backend = new CopyingBackend();
    const localClient = createOpenCv(backend);
    const detector = localClient.createAgastFeatureDetector();

    expect(detector.getDefaultName()).toBe("Feature2D.AgastFeatureDetector");
    expect(detector.getThreshold()).toBe(AGAST_FEATURE_DETECTOR_DEFAULTS.threshold);
    expect(detector.getNonmaxSuppression()).toBe(AGAST_FEATURE_DETECTOR_DEFAULTS.nonmaxSuppression);
    expect(detector.getType()).toBe(AgastFeatureDetector_DetectorType.OAST_9_16);

    detector.setThreshold(-1);
    detector.setNonmaxSuppression(false);
    detector.setType(AgastFeatureDetector_DetectorType.AGAST_7_12s);
    expect(detector.getThreshold()).toBe(-1);
    expect(detector.getNonmaxSuppression()).toBe(false);
    expect(detector.getType()).toBe(AgastFeatureDetector_DetectorType.AGAST_7_12s);

    detector.dispose();
    detector.dispose();
    expect(backend.agastFeatureDetectorFreeCount).toBe(1);
    expect(() => detector.getThreshold()).toThrow(BindingError);
  });

  test("validates AGAST construction and coerces instance thresholds", () => {
    const localClient = createOpenCv(new CopyingBackend());

    expect(() => localClient.createAgastFeatureDetector({ threshold: -2_147_483_649 })).toThrow(
      OpenCvInputError,
    );
    expect(() => localClient.createAgastFeatureDetector({ threshold: 2_147_483_648 })).toThrow(
      OpenCvInputError,
    );
    const detector = localClient.createAgastFeatureDetector({ threshold: -2_147_483_648 });
    expect(detector.getThreshold()).toBe(-2_147_483_648);
    detector.setThreshold(2_147_483_647);
    expect(detector.getThreshold()).toBe(2_147_483_647);
    expect(detector.setThreshold(1.5)).toBeUndefined();
    expect(detector.getThreshold()).toBe(1);
    detector.dispose();
  });

  test("owns a FastFeatureDetector configuration with OpenCV defaults", () => {
    const backend = new CopyingBackend();
    const localClient = createOpenCv(backend);
    const detector = localClient.createFastFeatureDetector();

    expect(detector.getDefaultName()).toBe("Feature2D.FastFeatureDetector");
    expect(detector.getThreshold()).toBe(FAST_FEATURE_DETECTOR_DEFAULTS.threshold);
    expect(detector.getNonmaxSuppression()).toBe(FAST_FEATURE_DETECTOR_DEFAULTS.nonmaxSuppression);
    expect(detector.getType()).toBe(FastFeatureDetector_DetectorType.TYPE_9_16);

    detector.setThreshold(256);
    detector.setNonmaxSuppression(false);
    detector.setType(FastFeatureDetector_DetectorType.TYPE_7_12);
    expect(detector.getThreshold()).toBe(256);
    expect(detector.getNonmaxSuppression()).toBe(false);
    expect(detector.getType()).toBe(FastFeatureDetector_DetectorType.TYPE_7_12);

    detector.dispose();
    detector.dispose();
    expect(backend.fastFeatureDetectorFreeCount).toBe(1);
    expect(() => detector.setNonmaxSuppression(true)).toThrow(BindingError);
  });

  test("validates FAST construction and coerces instance thresholds", () => {
    const localClient = createOpenCv(new CopyingBackend());

    expect(() => localClient.createFastFeatureDetector({ threshold: -2_147_483_649 })).toThrow(
      OpenCvInputError,
    );
    expect(() => localClient.createFastFeatureDetector({ threshold: 2_147_483_648 })).toThrow(
      OpenCvInputError,
    );
    const detector = localClient.createFastFeatureDetector({ threshold: -2_147_483_648 });
    expect(detector.getThreshold()).toBe(-2_147_483_648);
    detector.setThreshold(2_147_483_647);
    expect(detector.getThreshold()).toBe(2_147_483_647);
    expect(detector.setThreshold(Number.NaN)).toBeUndefined();
    expect(detector.getThreshold()).toBe(0);
    detector.dispose();
  });

  test("creates and mutates an explicit AKAZE configuration", () => {
    const localClient = createOpenCv(new CopyingBackend());
    const akaze = localClient.createAKAZE({
      descriptorType: AKAZEDescriptorType.MLDB_UPRIGHT,
      descriptorSize: 96,
      descriptorChannels: 2,
      threshold: 0.05,
      octaves: 5,
      octaveLayers: 6,
      diffusivity: KAZEDiffusivity.WEICKERT,
      maxPoints: 300,
    });

    expect(akaze.getDescriptorType()).toBe(AKAZE_DescriptorType.DESCRIPTOR_MLDB_UPRIGHT);
    expect(akaze.getDescriptorSize()).toBe(96);
    expect(akaze.getDescriptorChannels()).toBe(2);
    expect(akaze.getThreshold()).toBe(0.05);
    expect(akaze.getNOctaves()).toBe(5);
    expect(akaze.getNOctaveLayers()).toBe(6);
    expect(akaze.getDiffusivity()).toBe(KAZE_DiffusivityType.DIFF_WEICKERT);

    akaze.setDescriptorType(AKAZE_DescriptorType.DESCRIPTOR_KAZE);
    akaze.setDescriptorSize(128);
    akaze.setDescriptorChannels(3);
    akaze.setThreshold(0.1);
    akaze.setNOctaves(7);
    akaze.setNOctaveLayers(8);
    akaze.setDiffusivity(KAZE_DiffusivityType.DIFF_CHARBONNIER);
    expect(akaze.getDescriptorType()).toBe(AKAZE_DescriptorType.DESCRIPTOR_KAZE);
    expect(akaze.getDescriptorSize()).toBe(128);
    expect(akaze.getDescriptorChannels()).toBe(3);
    expect(akaze.getThreshold()).toBe(0.1);
    expect(akaze.getNOctaves()).toBe(7);
    expect(akaze.getNOctaveLayers()).toBe(8);
    expect(akaze.getDiffusivity()).toBe(KAZE_DiffusivityType.DIFF_CHARBONNIER);

    expect(akaze.setDescriptorSize(-1)).toBeUndefined();
    expect(akaze.getDescriptorSize()).toBe(-1);
    akaze.dispose();
    expect(() => akaze.setThreshold(0.2)).toThrow(BindingError);
    expect(() => localClient.createAKAZE({ descriptorSize: -1 })).toThrow(OpenCvInputError);
  });

  test("owns a GFTTDetector configuration with OpenCV 4.13 defaults", () => {
    const backend = new CopyingBackend();
    const localClient = createOpenCv(backend);
    const detector = localClient.createGFTTDetector();

    expect(detector.getDefaultName()).toBe("Feature2D.GFTTDetector");
    expect(detector.getMaxFeatures()).toBe(GFTT_DETECTOR_DEFAULTS.maxFeatures);
    expect(detector.getQualityLevel()).toBe(GFTT_DETECTOR_DEFAULTS.qualityLevel);
    expect(detector.getMinDistance()).toBe(GFTT_DETECTOR_DEFAULTS.minDistance);
    expect(detector.getBlockSize()).toBe(GFTT_DETECTOR_DEFAULTS.blockSize);
    expect(detector.getHarrisDetector()).toBe(GFTT_DETECTOR_DEFAULTS.useHarrisDetector);
    expect(detector.getK()).toBe(GFTT_DETECTOR_DEFAULTS.k);

    detector.dispose();
    detector.dispose();
    expect(backend.gfttDetectorFreeCount).toBe(1);
    expect(() => detector.getMaxFeatures()).toThrow(BindingError);
    expect(() => detector.setHarrisDetector(true)).toThrow(BindingError);
  });

  test("creates and mutates the full GFTTDetector configuration", () => {
    const localClient = createOpenCv(new CopyingBackend());
    const detector = localClient.createGFTTDetector({
      blockSize: -1,
      k: -1,
      maxFeatures: -1,
      minDistance: -1,
      qualityLevel: -1,
      useHarrisDetector: true,
    });

    expect(detector.getBlockSize()).toBe(-1);
    expect(detector.getK()).toBe(-1);
    expect(detector.getMaxFeatures()).toBe(-1);
    expect(detector.getMinDistance()).toBe(-1);
    expect(detector.getQualityLevel()).toBe(-1);
    expect(detector.getHarrisDetector()).toBe(true);

    detector.setBlockSize(-2_147_483_648);
    detector.setK(Number.NaN);
    detector.setMaxFeatures(2_147_483_647);
    detector.setMinDistance(Number.NEGATIVE_INFINITY);
    detector.setQualityLevel(Number.POSITIVE_INFINITY);
    detector.setHarrisDetector(false);
    expect(detector.getBlockSize()).toBe(-2_147_483_648);
    expect(detector.getK()).toBeNaN();
    expect(detector.getMaxFeatures()).toBe(2_147_483_647);
    expect(detector.getMinDistance()).toBe(Number.NEGATIVE_INFINITY);
    expect(detector.getQualityLevel()).toBe(Number.POSITIVE_INFINITY);
    expect(detector.getHarrisDetector()).toBe(false);
    detector.dispose();
  });

  test("validates GFTTDetector constructor integers and coerces instance setters", () => {
    const localClient = createOpenCv(new CopyingBackend());

    expect(() => localClient.createGFTTDetector({ maxFeatures: -2_147_483_649 })).toThrow(
      OpenCvInputError,
    );
    expect(() => localClient.createGFTTDetector({ blockSize: 2_147_483_648 })).toThrow(
      OpenCvInputError,
    );
    expect(() => localClient.createGFTTDetector({ blockSize: 1.5 })).toThrow(OpenCvInputError);
    const detector = localClient.createGFTTDetector();
    expect(detector.setMaxFeatures(Number.NaN)).toBeUndefined();
    expect(() => detector.setBlockSize(Number.POSITIVE_INFINITY)).toThrow(
      new TypeError(
        'Passing a number "Infinity" from JS side to C/C++ side to an argument of type "int", which is outside the valid range [-2147483648, 2147483647]!',
      ),
    );
    expect(detector.getMaxFeatures()).toBe(0);
    expect(detector.getBlockSize()).toBe(GFTT_DETECTOR_DEFAULTS.blockSize);
    detector.dispose();
  });

  test("owns a KAZE configuration with OpenCV 4.13 defaults", () => {
    const backend = new CopyingBackend();
    const localClient = createOpenCv(backend);
    const kaze = localClient.createKAZE();

    expect(kaze.getDefaultName()).toBe("Feature2D.KAZE");
    expect(kaze.getExtended()).toBe(KAZE_DEFAULTS.extended);
    expect(kaze.getUpright()).toBe(KAZE_DEFAULTS.upright);
    expect(kaze.getThreshold()).toBe(0.0010000000474974513);
    expect(kaze.getNOctaves()).toBe(KAZE_DEFAULTS.octaves);
    expect(kaze.getNOctaveLayers()).toBe(KAZE_DEFAULTS.octaveLayers);
    expect(kaze.getDiffusivity()).toBe(KAZE_DiffusivityType.DIFF_PM_G2);

    kaze.dispose();
    expect(backend.kazeFreeCount).toBe(1);
    kaze.dispose();
    expect(backend.kazeFreeCount).toBe(1);
    expect(() => kaze.getThreshold()).toThrow(BindingError);
  });

  test("creates and mutates an explicit KAZE configuration", () => {
    const localClient = createOpenCv(new CopyingBackend());
    const kaze = localClient.createKAZE({
      diffusivity: KAZEDiffusivity.WEICKERT,
      extended: true,
      octaveLayers: 6,
      octaves: 5,
      threshold: -1,
      upright: true,
    });

    expect(kaze.getExtended()).toBe(true);
    expect(kaze.getUpright()).toBe(true);
    expect(kaze.getThreshold()).toBe(-1);
    expect(kaze.getNOctaves()).toBe(5);
    expect(kaze.getNOctaveLayers()).toBe(6);
    expect(kaze.getDiffusivity()).toBe(KAZE_DiffusivityType.DIFF_WEICKERT);

    kaze.setExtended(false);
    kaze.setUpright(false);
    kaze.setThreshold(-0.25);
    kaze.setNOctaves(7);
    kaze.setNOctaveLayers(8);
    kaze.setDiffusivity(KAZE_DiffusivityType.DIFF_CHARBONNIER);
    expect(kaze.getExtended()).toBe(false);
    expect(kaze.getUpright()).toBe(false);
    expect(kaze.getThreshold()).toBe(-0.25);
    expect(kaze.getNOctaves()).toBe(7);
    expect(kaze.getNOctaveLayers()).toBe(8);
    expect(kaze.getDiffusivity()).toBe(KAZE_DiffusivityType.DIFF_CHARBONNIER);

    kaze.dispose();
    expect(() => kaze.setExtended(true)).toThrow(BindingError);
  });

  test("rejects invalid KAZE configuration before calling WASM", () => {
    const localClient = createOpenCv(new CopyingBackend());

    expect(() => localClient.createKAZE({ threshold: Number.NaN })).toThrow(OpenCvInputError);
    expect(() => localClient.createKAZE({ octaves: 0 })).toThrow(OpenCvInputError);
    expect(() => localClient.createKAZE({ octaveLayers: 2_147_483_648 })).toThrow(OpenCvInputError);
    const kaze = localClient.createKAZE();
    kaze.setNOctaves(1.5);
    kaze.setThreshold(Number.POSITIVE_INFINITY);
    expect(kaze.getDiffusivity()).toBe(KAZE_DiffusivityType.DIFF_PM_G2);
    expect(kaze.getNOctaves()).toBe(1);
    expect(kaze.getThreshold()).toBe(Number.POSITIVE_INFINITY);
    kaze.dispose();
  });
});
