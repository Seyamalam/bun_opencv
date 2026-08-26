import {
  createRgbaImage,
  validateDimension,
  validateRgbaImage,
  validateThreshold,
} from "./image.js";
import { OpenCvInputError } from "./error.js";
import { Mat, validateMatrixDimension, validateMatrixInput } from "./mat.js";
import type {
  BorderType,
  DecompositionMethod,
  HanningWindowDepth,
  MinMaxLocation,
  NormalizeType,
  NormType,
  OpenCv,
  OpenCvBackend,
  Point,
  Rect,
  RgbaImage,
  ReduceKind,
  Scalar,
  Size,
  StructuringElementKind,
} from "./types.js";

class WasmOpenCv implements OpenCv {
  readonly #backend: OpenCvBackend;

  constructor(backend: OpenCvBackend) {
    this.#backend = backend;
  }

  absdiff(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matAbsdiffU8(left.handleForBackend(), right.handleForBackend()));
  }

  add(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matAddU8(left.handleForBackend(), right.handleForBackend()));
  }

  arcLength(contour: Mat, closed: boolean): number {
    return this.#backend.matArcLength(contour.handleForBackend(), closed);
  }

  addWeighted(a: Mat, alpha: number, b: Mat, beta: number, gamma: number): Mat;
  addWeighted(a: Mat, alpha: number, b: Mat, beta: number, gamma: number, destination: Mat): void;
  addWeighted(
    a: Mat,
    alpha: number,
    b: Mat,
    beta: number,
    gamma: number,
    destination?: Mat,
  ): Mat | void {
    validateFiniteNumbers({ alpha, beta, gamma });
    if (destination !== undefined) {
      this.#backend.matAddWeightedInto(
        a.handleForBackend(),
        alpha,
        b.handleForBackend(),
        beta,
        gamma,
        destination.handleForBackend(),
      );
      return;
    }
    return new Mat(
      this.#backend.matAddWeighted(a.handleForBackend(), alpha, b.handleForBackend(), beta, gamma),
    );
  }

  bitwiseAnd(left: Mat, right: Mat): Mat {
    return new Mat(
      this.#backend.matBitwiseAndU8(left.handleForBackend(), right.handleForBackend()),
    );
  }

  bitwiseNot(source: Mat): Mat {
    return new Mat(this.#backend.matBitwiseNotU8(source.handleForBackend()));
  }

  bitwiseOr(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matBitwiseOrU8(left.handleForBackend(), right.handleForBackend()));
  }

  bitwiseXor(left: Mat, right: Mat): Mat {
    return new Mat(
      this.#backend.matBitwiseXorU8(left.handleForBackend(), right.handleForBackend()),
    );
  }

  boundingRect(contour: Mat): Rect {
    return rectangleFromArray(this.#backend.matBoundingRect(contour.handleForBackend()));
  }

  clipLine(rectangle: Rect, start: Point, end: Point): readonly [Point, Point] | undefined {
    validateRect(rectangle);
    validateIntegerPoint(start, "start");
    validateIntegerPoint(end, "end");
    return lineFromArray(
      this.#backend.clipLine(
        rectangle.x,
        rectangle.y,
        rectangle.width,
        rectangle.height,
        start.x,
        start.y,
        end.x,
        end.y,
      ),
    );
  }

  compareEqual(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matCompareEqU8(left.handleForBackend(), right.handleForBackend()));
  }

  cartToPolar(x: Mat, y: Mat, magnitude: Mat, angle: Mat, degrees = false): void {
    this.#backend.matCartToPolar(
      x.handleForBackend(),
      y.handleForBackend(),
      magnitude.handleForBackend(),
      angle.handleForBackend(),
      degrees,
    );
  }

  countNonZero(source: Mat): number {
    return this.#backend.matCountNonZero(source.handleForBackend());
  }

  contourArea(contour: Mat, oriented = false): number {
    return this.#backend.matContourArea(contour.handleForBackend(), oriented);
  }

  createHanningWindow(size: Size, depth: HanningWindowDepth): Mat {
    validateMinimumSize(size, 2, "Hanning window");
    return new Mat(this.#backend.createHanningWindow(size.width, size.height, depthCode(depth)));
  }

  determinant(source: Mat): number {
    return this.#backend.matDeterminant(source.handleForBackend());
  }

  convertScaleAbs(source: Mat, alpha?: number, beta?: number): Mat;
  convertScaleAbs(source: Mat, destination: Mat, alpha?: number, beta?: number): void;
  convertScaleAbs(
    source: Mat,
    destinationOrAlpha: Mat | number = 1,
    alphaOrBeta = 0,
    beta = 0,
  ): Mat | void {
    if (destinationOrAlpha instanceof Mat) {
      validateFiniteNumbers({ alpha: alphaOrBeta, beta });
      this.#backend.matConvertScaleAbsInto(
        source.handleForBackend(),
        destinationOrAlpha.handleForBackend(),
        alphaOrBeta,
        beta,
      );
      return;
    }
    validateFiniteNumbers({ alpha: destinationOrAlpha, beta: alphaOrBeta });
    return new Mat(
      this.#backend.matConvertScaleAbs(source.handleForBackend(), destinationOrAlpha, alphaOrBeta),
    );
  }

  copyMakeBorder(
    source: Mat,
    top: number,
    bottom: number,
    left: number,
    right: number,
    borderType: BorderType,
    constant: Scalar = [0, 0, 0, 0],
  ): Mat {
    validateBorderSize(top, "top");
    validateBorderSize(bottom, "bottom");
    validateBorderSize(left, "left");
    validateBorderSize(right, "right");
    validateFiniteNumbers({
      constant0: constant[0],
      constant1: constant[1],
      constant2: constant[2],
      constant3: constant[3],
    });
    return new Mat(
      this.#backend.matCopyMakeBorder(
        source.handleForBackend(),
        top,
        bottom,
        left,
        right,
        borderType,
        Float64Array.from(constant),
      ),
    );
  }

  divide(a: Mat, b: Mat, scale?: number): Mat;
  divide(a: Mat, b: Mat, destination: Mat, scale?: number): void;
  divide(a: Mat, b: Mat, destinationOrScale: Mat | number = 1, scale = 1): Mat | void {
    if (destinationOrScale instanceof Mat) {
      validateFiniteNumbers({ scale });
      this.#backend.matDivideInto(
        a.handleForBackend(),
        b.handleForBackend(),
        destinationOrScale.handleForBackend(),
        scale,
      );
      return;
    }
    scale = destinationOrScale;
    validateFiniteNumbers({ scale });
    return new Mat(this.#backend.matDivide(a.handleForBackend(), b.handleForBackend(), scale));
  }

  extractChannel(source: Mat, channel: number): Mat {
    validateChannelIndex(channel);
    return new Mat(this.#backend.matExtractChannel(source.handleForBackend(), channel));
  }

  ellipse2Poly(
    center: Point,
    axes: Size,
    rotationDegrees: number,
    arcStart: number,
    arcEnd: number,
    delta: number,
  ): Point[] {
    validateIntegerPoint(center, "center");
    validateNonNegativeInteger(axes.width, "axes.width");
    validateNonNegativeInteger(axes.height, "axes.height");
    validateSignedInteger(rotationDegrees, "rotationDegrees");
    validateSignedInteger(arcStart, "arcStart");
    validateSignedInteger(arcEnd, "arcEnd");
    validateSignedInteger(delta, "delta");
    return pointsFromArray(
      this.#backend.ellipse2Poly(
        center.x,
        center.y,
        axes.width,
        axes.height,
        rotationDegrees,
        arcStart,
        arcEnd,
        delta,
      ),
    );
  }

  exp(source: Mat): Mat {
    return new Mat(this.#backend.matExp(source.handleForBackend()));
  }

  flip(source: Mat, flipCode: -1 | 0 | 1): Mat;
  flip(source: Mat, destination: Mat, flipCode: -1 | 0 | 1): void;
  flip(source: Mat, destinationOrCode: Mat | -1 | 0 | 1, flipCode?: -1 | 0 | 1): Mat | void {
    if (destinationOrCode instanceof Mat) {
      this.#backend.matFlipInto(
        source.handleForBackend(),
        destinationOrCode.handleForBackend(),
        requiredCode(flipCode),
      );
      return;
    }
    return new Mat(this.#backend.matFlip(source.handleForBackend(), destinationOrCode));
  }

  rotate(source: Mat, rotateCode: 0 | 1 | 2): Mat;
  rotate(source: Mat, destination: Mat, rotateCode: 0 | 1 | 2): void;
  rotate(source: Mat, destinationOrCode: Mat | 0 | 1 | 2, rotateCode?: 0 | 1 | 2): Mat | void {
    if (destinationOrCode instanceof Mat) {
      this.#backend.matRotateInto(
        source.handleForBackend(),
        destinationOrCode.handleForBackend(),
        requiredCode(rotateCode),
      );
      return;
    }
    return new Mat(this.#backend.matRotate(source.handleForBackend(), destinationOrCode));
  }

  grayscale(image: RgbaImage): RgbaImage {
    validateRgbaImage(image);
    const data = this.#backend.grayscaleRgba(image.data, image.width, image.height);
    return createRgbaImage(image.width, image.height, data);
  }

  hconcat(
    sources: readonly [Mat, Mat] | readonly [Mat, Mat, Mat] | readonly [Mat, Mat, Mat, Mat],
  ): Mat {
    return this.#concat(sources, "horizontal");
  }

  getAffineTransform(source: Mat, destination: Mat): Mat {
    return new Mat(
      this.#backend.matGetAffineTransform(
        source.handleForBackend(),
        destination.handleForBackend(),
      ),
    );
  }

  getPerspectiveTransform(source: Mat, destination: Mat): Mat {
    return new Mat(
      this.#backend.matGetPerspectiveTransform(
        source.handleForBackend(),
        destination.handleForBackend(),
      ),
    );
  }

  getRotationMatrix2D(center: Point, angleDegrees: number, scale: number): Mat {
    validateFinitePoint(center, "center");
    validateFiniteNumbers({ angleDegrees, scale });
    return new Mat(this.#backend.matGetRotationMatrix2D(center.x, center.y, angleDegrees, scale));
  }

  getStructuringElement(
    kind: StructuringElementKind,
    size: Size,
    anchor: Point = { x: -1, y: -1 },
  ): Mat {
    validateMinimumSize(size, 1, "structuring element");
    validateIntegerPoint(anchor, "anchor");
    return new Mat(
      this.#backend.getStructuringElement(kind, size.width, size.height, anchor.x, anchor.y),
    );
  }

  invert(image: RgbaImage): RgbaImage;
  invert(source: Mat, destination: Mat, method?: DecompositionMethod): number;
  invert(
    imageOrSource: RgbaImage | Mat,
    destination?: Mat,
    method: DecompositionMethod = 0,
  ): RgbaImage | number {
    if (imageOrSource instanceof Mat) {
      if (destination === undefined) {
        throw new OpenCvInputError("matrix inverse requires a destination");
      }
      return this.#backend.matInvertInto(
        imageOrSource.handleForBackend(),
        destination.handleForBackend(),
        method,
      );
    }
    validateRgbaImage(imageOrSource);
    const data = this.#backend.invertRgba(
      imageOrSource.data,
      imageOrSource.width,
      imageOrSource.height,
    );
    return createRgbaImage(imageOrSource.width, imageOrSource.height, data);
  }

  matFromF32(rows: number, columns: number, channels: number, data: Float32Array): Mat {
    validateMatrixInput(rows, columns, channels, data.byteLength, Float32Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matFromF32(data, rows, columns, channels));
  }

  matFromF64(rows: number, columns: number, channels: number, data: Float64Array): Mat {
    validateMatrixInput(rows, columns, channels, data.byteLength, Float64Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matFromF64(data, rows, columns, channels));
  }

  matFromI16(rows: number, columns: number, channels: number, data: Int16Array): Mat {
    validateMatrixInput(rows, columns, channels, data.byteLength, Int16Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matFromI16(data, rows, columns, channels));
  }

  matFromI32(rows: number, columns: number, channels: number, data: Int32Array): Mat {
    validateMatrixInput(rows, columns, channels, data.byteLength, Int32Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matFromI32(data, rows, columns, channels));
  }

  matFromI8(rows: number, columns: number, channels: number, data: Int8Array): Mat {
    validateMatrixInput(rows, columns, channels, data.byteLength, Int8Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matFromI8(data, rows, columns, channels));
  }

  matFromU16(rows: number, columns: number, channels: number, data: Uint16Array): Mat {
    validateMatrixInput(rows, columns, channels, data.byteLength, Uint16Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matFromU16(data, rows, columns, channels));
  }

  matFromU8(rows: number, columns: number, channels: number, data: Uint8Array): Mat {
    validateMatrixInput(rows, columns, channels, data.byteLength);
    return new Mat(this.#backend.matFromU8(data, rows, columns, channels));
  }

  inRange(source: Mat, lowerBound: Mat, upperBound: Mat): Mat {
    return new Mat(
      this.#backend.matInRangeU8(
        source.handleForBackend(),
        lowerBound.handleForBackend(),
        upperBound.handleForBackend(),
      ),
    );
  }

  insertChannel(source: Mat, destination: Mat, channel: number): void {
    validateChannelIndex(channel);
    this.#backend.matInsertChannel(
      source.handleForBackend(),
      destination.handleForBackend(),
      channel,
    );
  }

  invertAffineTransform(transform: Mat): Mat {
    return new Mat(this.#backend.matInvertAffineTransform(transform.handleForBackend()));
  }

  isContourConvex(contour: Mat): boolean {
    return this.#backend.matIsContourConvex(contour.handleForBackend());
  }

  log(source: Mat): Mat {
    return new Mat(this.#backend.matLog(source.handleForBackend()));
  }

  lut(source: Mat, table: Mat): Mat;
  lut(source: Mat, table: Mat, destination: Mat): void;
  lut(source: Mat, table: Mat, destination?: Mat): Mat | void {
    if (destination !== undefined) {
      this.#backend.matLutInto(
        source.handleForBackend(),
        table.handleForBackend(),
        destination.handleForBackend(),
      );
      return;
    }
    return new Mat(this.#backend.matLut(source.handleForBackend(), table.handleForBackend()));
  }

  magnitude(x: Mat, y: Mat): Mat {
    return new Mat(this.#backend.matMagnitude(x.handleForBackend(), y.handleForBackend()));
  }

  max(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matMaxU8(left.handleForBackend(), right.handleForBackend()));
  }

  mean(source: Mat): Scalar {
    return scalarFromArray(this.#backend.matMean(source.handleForBackend()));
  }

  meanStdDev(source: Mat, means: Mat, standardDeviations: Mat, mask?: Mat): void {
    if (mask === undefined) {
      this.#backend.matMeanStdDevInto(
        source.handleForBackend(),
        means.handleForBackend(),
        standardDeviations.handleForBackend(),
      );
      return;
    }
    this.#backend.matMeanStdDevMaskedInto(
      source.handleForBackend(),
      means.handleForBackend(),
      standardDeviations.handleForBackend(),
      mask.handleForBackend(),
    );
  }

  merge(
    sources: readonly [Mat, Mat] | readonly [Mat, Mat, Mat] | readonly [Mat, Mat, Mat, Mat],
  ): Mat {
    const handles = sources.map((source) => source.handleForBackend());
    const first = handles[0];
    const second = handles[1];
    if (first === undefined || second === undefined) {
      throw new OpenCvInputError("merge requires two through four matrices");
    }
    if (handles.length === 2) {
      return new Mat(this.#backend.matMerge(first, second));
    }
    const third = handles[2];
    if (third === undefined) {
      throw new OpenCvInputError("merge requires a third matrix");
    }
    if (handles.length === 3) {
      return new Mat(this.#backend.matMerge3(first, second, third));
    }
    const fourth = handles[3];
    if (fourth === undefined) {
      throw new OpenCvInputError("merge requires a fourth matrix");
    }
    return new Mat(this.#backend.matMerge4(first, second, third, fourth));
  }

  min(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matMinU8(left.handleForBackend(), right.handleForBackend()));
  }

  mixChannels(source: Mat, destination: Mat, fromTo: Uint16Array): void {
    if (fromTo.length % 2 !== 0) {
      throw new OpenCvInputError("fromTo must contain source/destination channel pairs");
    }
    this.#backend.matMixChannels(source.handleForBackend(), destination.handleForBackend(), fromTo);
  }

  multiply(a: Mat, b: Mat, scale?: number): Mat;
  multiply(a: Mat, b: Mat, destination: Mat, scale?: number): void;
  multiply(a: Mat, b: Mat, destinationOrScale: Mat | number = 1, scale = 1): Mat | void {
    if (destinationOrScale instanceof Mat) {
      validateFiniteNumbers({ scale });
      this.#backend.matMultiplyInto(
        a.handleForBackend(),
        b.handleForBackend(),
        destinationOrScale.handleForBackend(),
        scale,
      );
      return;
    }
    scale = destinationOrScale;
    validateFiniteNumbers({ scale });
    return new Mat(this.#backend.matMultiply(a.handleForBackend(), b.handleForBackend(), scale));
  }

  norm(source: Mat, normType?: NormType, mask?: Mat): number;
  norm(first: Mat, second: Mat, normType?: NormType, mask?: Mat): number;
  norm(
    first: Mat,
    secondOrType: Mat | NormType = 4,
    typeOrMask?: NormType | Mat,
    mask?: Mat,
  ): number {
    if (secondOrType instanceof Mat) {
      const resolvedMask = typeOrMask instanceof Mat ? typeOrMask : mask;
      const normType = typeOrMask instanceof Mat ? 4 : (typeOrMask ?? 4);
      return resolvedMask === undefined
        ? this.#backend.matNormDiff(
            first.handleForBackend(),
            secondOrType.handleForBackend(),
            normType,
          )
        : this.#backend.matNormDiffMasked(
            first.handleForBackend(),
            secondOrType.handleForBackend(),
            normType,
            resolvedMask.handleForBackend(),
          );
    }
    const resolvedMask = typeOrMask instanceof Mat ? typeOrMask : undefined;
    return resolvedMask === undefined
      ? this.#backend.matNorm(first.handleForBackend(), secondOrType)
      : this.#backend.matNormMasked(
          first.handleForBackend(),
          secondOrType,
          resolvedMask.handleForBackend(),
        );
  }

  normalize(
    source: Mat,
    destination: Mat,
    alpha: number,
    beta: number,
    normType: NormalizeType,
    mask?: Mat,
  ): void {
    validateFiniteNumbers({ alpha, beta });
    if (mask === undefined) {
      this.#backend.matNormalizeInto(
        source.handleForBackend(),
        destination.handleForBackend(),
        alpha,
        beta,
        normType,
      );
      return;
    }
    this.#backend.matNormalizeMaskedInto(
      source.handleForBackend(),
      destination.handleForBackend(),
      alpha,
      beta,
      normType,
      mask.handleForBackend(),
    );
  }

  polarToCart(magnitude: Mat, angle: Mat, x: Mat, y: Mat, degrees = false): void {
    this.#backend.matPolarToCart(
      magnitude.handleForBackend(),
      angle.handleForBackend(),
      x.handleForBackend(),
      y.handleForBackend(),
      degrees,
    );
  }

  pointPolygonTest(contour: Mat, point: Point, measureDistance: boolean): number {
    validateFinitePoint(point, "point");
    return this.#backend.matPointPolygonTest(
      contour.handleForBackend(),
      point.x,
      point.y,
      measureDistance,
    );
  }

  perspectiveTransform(source: Mat, coefficients: Mat): Mat;
  perspectiveTransform(source: Mat, coefficients: Mat, destination: Mat): void;
  perspectiveTransform(source: Mat, coefficients: Mat, destination?: Mat): Mat | void {
    if (destination !== undefined) {
      this.#backend.matPerspectiveTransformInto(
        source.handleForBackend(),
        coefficients.handleForBackend(),
        destination.handleForBackend(),
      );
      return;
    }
    return new Mat(
      this.#backend.matPerspectiveTransform(
        source.handleForBackend(),
        coefficients.handleForBackend(),
      ),
    );
  }

  pow(source: Mat, exponent: number): Mat {
    if (!Number.isFinite(exponent)) {
      throw new OpenCvInputError("exponent must be finite");
    }
    return new Mat(this.#backend.matPow(source.handleForBackend(), exponent));
  }

  randn(destination: Mat, mean: Scalar, standardDeviation: Scalar): void {
    this.#backend.matRandn(
      destination.handleForBackend(),
      validatedScalar(mean, "mean"),
      validatedScalar(standardDeviation, "standardDeviation"),
    );
  }

  randu(destination: Mat, lower: Scalar, upper: Scalar): void {
    this.#backend.matRandu(
      destination.handleForBackend(),
      validatedScalar(lower, "lower"),
      validatedScalar(upper, "upper"),
    );
  }

  minMaxLoc(source: Mat): MinMaxLocation {
    return minMaxLocationFromArray(this.#backend.matMinMaxLoc(source.handleForBackend()));
  }

  resizeNearest(image: RgbaImage, targetWidth: number, targetHeight: number): RgbaImage {
    validateRgbaImage(image);
    validateDimension(targetWidth, "targetWidth");
    validateDimension(targetHeight, "targetHeight");
    const data = this.#backend.resizeNearestRgba(
      image.data,
      image.width,
      image.height,
      targetWidth,
      targetHeight,
    );
    return createRgbaImage(targetWidth, targetHeight, data);
  }

  repeat(source: Mat, rowRepeats: number, columnRepeats: number): Mat;
  repeat(source: Mat, rowRepeats: number, columnRepeats: number, destination: Mat): void;
  repeat(source: Mat, rowRepeats: number, columnRepeats: number, destination?: Mat): Mat | void {
    validateDimension(rowRepeats, "rowRepeats");
    validateDimension(columnRepeats, "columnRepeats");
    if (destination !== undefined) {
      this.#backend.matRepeatInto(
        source.handleForBackend(),
        destination.handleForBackend(),
        rowRepeats,
        columnRepeats,
      );
      return;
    }
    return new Mat(this.#backend.matRepeat(source.handleForBackend(), rowRepeats, columnRepeats));
  }

  reduce(source: Mat, destination: Mat, axis: 0 | 1, kind: ReduceKind): void {
    this.#backend.matReduceInto(
      source.handleForBackend(),
      destination.handleForBackend(),
      axis,
      kind,
    );
  }

  setIdentity(destination: Mat, value: Scalar = [1, 0, 0, 0]): void {
    this.#backend.matSetIdentity(destination.handleForBackend(), validatedScalar(value, "value"));
  }

  setRNGSeed(seed: number): void {
    if (!Number.isSafeInteger(seed) || seed < -2_147_483_648 || seed > 2_147_483_647) {
      throw new OpenCvInputError("seed must be a signed 32-bit integer");
    }
    this.#backend.setRNGSeed(seed);
  }

  solve(
    coefficients: Mat,
    rightHandSides: Mat,
    destination: Mat,
    method: DecompositionMethod = 0,
  ): boolean {
    return this.#backend.matSolveInto(
      coefficients.handleForBackend(),
      rightHandSides.handleForBackend(),
      destination.handleForBackend(),
      method,
    );
  }

  threshold(image: RgbaImage, threshold: number): RgbaImage {
    validateRgbaImage(image);
    validateThreshold(threshold);
    const data = this.#backend.thresholdRgba(image.data, image.width, image.height, threshold);
    return createRgbaImage(image.width, image.height, data);
  }

  subtract(left: Mat, right: Mat): Mat {
    return new Mat(this.#backend.matSubtractU8(left.handleForBackend(), right.handleForBackend()));
  }

  split(source: Mat): Mat[] {
    return this.#backend.matSplit(source.handleForBackend()).map((handle) => new Mat(handle));
  }

  sqrt(source: Mat): Mat {
    return new Mat(this.#backend.matSqrt(source.handleForBackend()));
  }

  sum(source: Mat): Scalar {
    return scalarFromArray(this.#backend.matSum(source.handleForBackend()));
  }

  transpose(source: Mat): Mat;
  transpose(source: Mat, destination: Mat): void;
  transpose(source: Mat, destination?: Mat): Mat | void {
    if (destination !== undefined) {
      this.#backend.matTransposeInto(source.handleForBackend(), destination.handleForBackend());
      return;
    }
    return new Mat(this.#backend.matTranspose(source.handleForBackend()));
  }

  trace(source: Mat): number {
    return this.#backend.matTrace(source.handleForBackend());
  }

  transform(source: Mat, coefficients: Mat): Mat;
  transform(source: Mat, coefficients: Mat, destination: Mat): void;
  transform(source: Mat, coefficients: Mat, destination?: Mat): Mat | void {
    if (destination !== undefined) {
      this.#backend.matTransformInto(
        source.handleForBackend(),
        coefficients.handleForBackend(),
        destination.handleForBackend(),
      );
      return;
    }
    return new Mat(
      this.#backend.matTransform(source.handleForBackend(), coefficients.handleForBackend()),
    );
  }

  vconcat(
    sources: readonly [Mat, Mat] | readonly [Mat, Mat, Mat] | readonly [Mat, Mat, Mat, Mat],
  ): Mat {
    return this.#concat(sources, "vertical");
  }

  #concat(
    sources: readonly [Mat, Mat] | readonly [Mat, Mat, Mat] | readonly [Mat, Mat, Mat, Mat],
    direction: "horizontal" | "vertical",
  ): Mat {
    const handles = sources.map((source) => source.handleForBackend());
    const [first, second, third, fourth] = handles;
    if (first === undefined || second === undefined) {
      throw new OpenCvInputError("concat requires two through four matrices");
    }
    const prefix = direction === "horizontal" ? "matHconcat" : "matVconcat";
    if (third === undefined) {
      return new Mat(this.#backend[`${prefix}2`](first, second));
    }
    if (fourth === undefined) {
      return new Mat(this.#backend[`${prefix}3`](first, second, third));
    }
    return new Mat(this.#backend[`${prefix}4`](first, second, third, fourth));
  }

  zerosF32(rows: number, columns: number, channels: number): Mat {
    validateZeroAllocation(rows, columns, channels, Float32Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matZerosF32(rows, columns, channels));
  }

  zerosF64(rows: number, columns: number, channels: number): Mat {
    validateZeroAllocation(rows, columns, channels, Float64Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matZerosF64(rows, columns, channels));
  }

  zerosI16(rows: number, columns: number, channels: number): Mat {
    validateZeroAllocation(rows, columns, channels, Int16Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matZerosI16(rows, columns, channels));
  }

  zerosI32(rows: number, columns: number, channels: number): Mat {
    validateZeroAllocation(rows, columns, channels, Int32Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matZerosI32(rows, columns, channels));
  }

  zerosI8(rows: number, columns: number, channels: number): Mat {
    validateZeroAllocation(rows, columns, channels, Int8Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matZerosI8(rows, columns, channels));
  }

  zerosU16(rows: number, columns: number, channels: number): Mat {
    validateZeroAllocation(rows, columns, channels, Uint16Array.BYTES_PER_ELEMENT);
    return new Mat(this.#backend.matZerosU16(rows, columns, channels));
  }

  zerosU8(rows: number, columns: number, channels: number): Mat {
    validateMatrixDimension(rows, "rows");
    validateMatrixDimension(columns, "columns");
    validateMatrixInput(rows, columns, channels, rows * columns * channels);
    return new Mat(this.#backend.matZerosU8(rows, columns, channels));
  }
}

function validateZeroAllocation(
  rows: number,
  columns: number,
  channels: number,
  byteWidth: number,
): void {
  validateMatrixInput(rows, columns, channels, rows * columns * channels * byteWidth, byteWidth);
}

function scalarFromArray(values: Float64Array): Scalar {
  if (values.length !== 4) {
    throw new OpenCvInputError(`WASM scalar has ${values.length} lanes; expected 4`);
  }
  const lane0 = values[0];
  const lane1 = values[1];
  const lane2 = values[2];
  const lane3 = values[3];
  if (lane0 === undefined || lane1 === undefined || lane2 === undefined || lane3 === undefined) {
    throw new OpenCvInputError("WASM scalar is missing a lane");
  }
  return [lane0, lane1, lane2, lane3];
}

function minMaxLocationFromArray(values: Float64Array): MinMaxLocation {
  if (values.length !== 6) {
    throw new OpenCvInputError(`WASM minMaxLoc result has ${values.length} lanes; expected 6`);
  }
  const minVal = requiredFloat(values, 0);
  const maxVal = requiredFloat(values, 1);
  const minX = requiredFloat(values, 2);
  const minY = requiredFloat(values, 3);
  const maxX = requiredFloat(values, 4);
  const maxY = requiredFloat(values, 5);
  return {
    maxLoc: { x: maxX, y: maxY },
    maxVal,
    minLoc: { x: minX, y: minY },
    minVal,
  };
}

function rectangleFromArray(values: Int32Array): Rect {
  if (values.length !== 4) {
    throw new OpenCvInputError(`WASM rectangle has ${values.length} lanes; expected 4`);
  }
  return {
    x: requiredInteger(values, 0),
    y: requiredInteger(values, 1),
    width: requiredInteger(values, 2),
    height: requiredInteger(values, 3),
  };
}

function lineFromArray(values: Int32Array): readonly [Point, Point] | undefined {
  if (values.length === 0) return undefined;
  if (values.length !== 4) {
    throw new OpenCvInputError(`WASM clipped line has ${values.length} lanes; expected 0 or 4`);
  }
  return [
    { x: requiredInteger(values, 0), y: requiredInteger(values, 1) },
    { x: requiredInteger(values, 2), y: requiredInteger(values, 3) },
  ];
}

function pointsFromArray(values: Int32Array): Point[] {
  if (values.length % 2 !== 0) {
    throw new OpenCvInputError(`WASM point array has ${values.length} lanes; expected pairs`);
  }
  const points: Point[] = [];
  for (let index = 0; index < values.length; index += 2) {
    points.push({ x: requiredInteger(values, index), y: requiredInteger(values, index + 1) });
  }
  return points;
}

function requiredFloat(values: Float64Array, index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new OpenCvInputError(`WASM result is missing lane ${index}`);
  }
  return value;
}

function requiredInteger(values: Int32Array, index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new OpenCvInputError(`WASM integer result is missing lane ${index}`);
  }
  return value;
}

function requiredCode<T extends number>(value: T | undefined): T {
  if (value === undefined) {
    throw new OpenCvInputError("operation code is required when a destination is supplied");
  }
  return value;
}

function validateChannelIndex(channel: number): void {
  if (!Number.isSafeInteger(channel) || channel < 0 || channel > 511) {
    throw new OpenCvInputError("channel must be a non-negative integer below 512");
  }
}

function validateFiniteNumbers(values: Readonly<Record<string, number>>): void {
  for (const [name, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) throw new OpenCvInputError(`${name} must be finite`);
  }
}

function validateFinitePoint(point: Point, name: string): void {
  validateFiniteNumbers({ [`${name}.x`]: point.x, [`${name}.y`]: point.y });
}

function validateIntegerPoint(point: Point, name: string): void {
  validateSignedInteger(point.x, `${name}.x`);
  validateSignedInteger(point.y, `${name}.y`);
}

function validateSignedInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < -2_147_483_648 || value > 2_147_483_647) {
    throw new OpenCvInputError(`${name} must be a signed 32-bit integer`);
  }
}

function validateNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) {
    throw new OpenCvInputError(`${name} must be a non-negative signed 32-bit integer`);
  }
}

function validateMinimumSize(size: Size, minimum: number, name: string): void {
  validateDimension(size.width, `${name}.width`);
  validateDimension(size.height, `${name}.height`);
  if (size.width < minimum || size.height < minimum) {
    throw new OpenCvInputError(`${name} dimensions must be at least ${minimum}`);
  }
}

function validateRect(rectangle: Rect): void {
  validateSignedInteger(rectangle.x, "rectangle.x");
  validateSignedInteger(rectangle.y, "rectangle.y");
  validateDimension(rectangle.width, "rectangle.width");
  validateDimension(rectangle.height, "rectangle.height");
}

function depthCode(depth: HanningWindowDepth): number {
  return depth === "f32" ? 5 : 6;
}

function validatedScalar(value: Scalar, name: string): Float64Array {
  validateFiniteNumbers({
    [`${name}[0]`]: value[0],
    [`${name}[1]`]: value[1],
    [`${name}[2]`]: value[2],
    [`${name}[3]`]: value[3],
  });
  return Float64Array.from(value);
}

function validateBorderSize(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 4_294_967_295) {
    throw new OpenCvInputError(`${name} border must be a non-negative 32-bit integer`);
  }
}

/** Creates a client from a compatible backend. Most callers should use `initOpenCv`. */
export function createOpenCv(backend: OpenCvBackend): OpenCv {
  return new WasmOpenCv(backend);
}
