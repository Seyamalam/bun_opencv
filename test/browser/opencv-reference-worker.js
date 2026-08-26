/* global importScripts, cv */
/* oxlint-disable unicorn/require-post-message-target-origin, anti-slop/no-runtime-typeof */

function copyBytes(matrix) {
  return new Uint8Array(matrix.data);
}

function copyF64(matrix) {
  return Array.from(matrix.data64F);
}

function summarizeMat(matrix) {
  const elementSize = matrix.elemSize();
  const rowByteLength = matrix.cols * elementSize;
  return {
    rows: matrix.rows,
    cols: matrix.cols,
    type: matrix.type(),
    depth: matrix.depth(),
    channels: matrix.channels(),
    elementSize,
    empty: matrix.empty(),
    continuous: matrix.isContinuous(),
    bytes: Array.from({ length: matrix.rows }, (_, row) =>
      Array.from(matrix.ucharPtr(row).subarray(0, rowByteLength)),
    ).flat(),
  };
}

function summarizeTypedMat(matrix) {
  const summary = summarizeMat(matrix);
  const pointerMethod = [
    "ucharPtr",
    "charPtr",
    "ushortPtr",
    "shortPtr",
    "intPtr",
    "floatPtr",
    "doublePtr",
  ][summary.depth];
  const rowScalarLength = summary.cols * summary.channels;
  const values = Array.from({ length: summary.rows }, (_, row) =>
    Array.from(matrix[pointerMethod](row).subarray(0, rowScalarLength)),
  ).flat();
  return { ...summary, values };
}

function makeSeedMat(reference, rows, cols, type, values) {
  return reference.matFromArray(rows, cols, type, values);
}

function auditTransposeCall(callback, matrices) {
  const before = Object.fromEntries(
    matrices.map(([name, matrix]) => [name, capturePrimitive(() => summarizeMat(matrix))]),
  );
  const call = captureCall(callback);
  const after = Object.fromEntries(
    matrices.map(([name, matrix]) => [name, capturePrimitive(() => summarizeMat(matrix))]),
  );
  return { before, call, after };
}

function auditTypedMatCall(callback, matrices) {
  const summarize = ([name, matrix]) => [name, capturePrimitive(() => summarizeTypedMat(matrix))];
  const before = Object.fromEntries(matrices.map(summarize));
  const call = captureCall(callback);
  const after = Object.fromEntries(matrices.map(summarize));
  return { before, call, after };
}

function auditTransposeDestination(reference, name, createDestination) {
  const source = makeSeedMat(reference, 2, 3, reference.CV_8UC1, [1, 2, 3, 4, 5, 6]);
  const destination = createDestination();
  const result = {
    name,
    audit: auditTransposeCall(
      () => reference.transpose(source, destination),
      [
        ["source", source],
        ["destination", destination],
      ],
    ),
  };
  safeDelete(destination);
  safeDelete(source);
  return result;
}

function auditTransposeInPlace(reference, rows, cols, values) {
  const matrix = makeSeedMat(reference, rows, cols, reference.CV_8UC1, values);
  const result = auditTransposeCall(
    () => reference.transpose(matrix, matrix),
    [["matrix", matrix]],
  );
  safeDelete(matrix);
  return result;
}

function auditTransposeRoi(reference, name, sourceRect, destinationRect, sameParent = false) {
  const sourceParent = makeSeedMat(
    reference,
    4,
    5,
    reference.CV_8UC1,
    Array.from({ length: 20 }, (_, index) => index + 1),
  );
  const destinationParent = sameParent
    ? sourceParent
    : makeSeedMat(reference, 5, 5, reference.CV_8UC1, new Uint8Array(25).fill(99));
  const source = sourceParent.roi(new reference.Rect(...sourceRect));
  const destination = destinationParent.roi(new reference.Rect(...destinationRect));
  const result = {
    name,
    sameParent,
    audit: auditTransposeCall(
      () => reference.transpose(source, destination),
      [
        ["source", source],
        ["destination", destination],
        ["sourceParent", sourceParent],
        ["destinationParent", destinationParent],
      ],
    ),
  };
  safeDelete(destination);
  safeDelete(source);
  if (!sameParent) safeDelete(destinationParent);
  safeDelete(sourceParent);
  return result;
}

function auditTransposeType(reference, name, type, values) {
  if (typeof type !== "number") return { name, available: false };
  let source;
  let destination;
  try {
    source = makeSeedMat(reference, 2, 3, type, values);
    destination = new reference.Mat();
    return {
      name,
      available: true,
      audit: auditTransposeCall(
        () => reference.transpose(source, destination),
        [
          ["source", source],
          ["destination", destination],
        ],
      ),
    };
  } catch (error) {
    return {
      name,
      available: true,
      setup: captureCall(() => {
        throw error;
      }),
    };
  } finally {
    safeDelete(destination);
    safeDelete(source);
  }
}

function auditTranspose(reference) {
  const aritySource = makeSeedMat(reference, 2, 3, reference.CV_8UC1, [1, 2, 3, 4, 5, 6]);
  const arityDestination = new reference.Mat();
  const arity = {
    functionLength: capturePrimitive(() => reference.transpose.length),
    zero: captureCall(() => reference.transpose()),
    one: captureCall(() => reference.transpose(aritySource)),
    two: captureCall(() => reference.transpose(aritySource, arityDestination)),
    three: captureCall(() => reference.transpose(aritySource, arityDestination, 1)),
    destinationAfter: capturePrimitive(() => summarizeMat(arityDestination)),
  };
  safeDelete(arityDestination);
  safeDelete(aritySource);

  const emptySource = new reference.Mat();
  const emptyDestination = new reference.Mat();
  const empty = auditTransposeCall(
    () => reference.transpose(emptySource, emptyDestination),
    [
      ["source", emptySource],
      ["destination", emptyDestination],
    ],
  );
  safeDelete(emptyDestination);
  safeDelete(emptySource);

  const deletedSource = makeSeedMat(reference, 1, 1, reference.CV_8UC1, [7]);
  const liveDestination = new reference.Mat();
  deletedSource.delete();
  const deletedSourceAudit = auditTransposeCall(
    () => reference.transpose(deletedSource, liveDestination),
    [
      ["source", deletedSource],
      ["destination", liveDestination],
    ],
  );
  safeDelete(liveDestination);

  const liveSource = makeSeedMat(reference, 1, 1, reference.CV_8UC1, [8]);
  const deletedDestination = new reference.Mat();
  deletedDestination.delete();
  const deletedDestinationAudit = auditTransposeCall(
    () => reference.transpose(liveSource, deletedDestination),
    [
      ["source", liveSource],
      ["destination", deletedDestination],
    ],
  );
  safeDelete(liveSource);

  const types = [
    ["CV_8UC1", reference.CV_8UC1, [1, 2, 3, 4, 5, 6]],
    ["CV_8UC3", reference.CV_8UC3, Array.from({ length: 18 }, (_, index) => index + 1)],
    ["CV_8SC2", reference.CV_8SC2, [-1, 2, -3, 4, -5, 6, -7, 8, -9, 10, -11, 12]],
    ["CV_16UC1", reference.CV_16UC1, [1, 256, 513, 1024, 4096, 65_535]],
    [
      "CV_16SC2",
      reference.CV_16SC2,
      [-1, 2, -300, 400, -500, 600, -700, 800, -900, 1000, -1100, 1200],
    ],
    ["CV_32SC1", reference.CV_32SC1, [-1, 2, -300_000, 400_000, -500_000, 600_000]],
    [
      "CV_32FC2",
      reference.CV_32FC2,
      [-1.5, 2.25, -3.5, 4.75, -5.5, 6.25, -7.5, 8.75, -9.5, 10.25, -11.5, 12.75],
    ],
    ["CV_64FC1", reference.CV_64FC1, [-1.5, 2.25, -3.5, 4.75, -5.5, 6.25]],
    ["CV_16FC1", reference.CV_16FC1, [1, 2, 3, 4, 5, 6]],
  ].map(([name, type, values]) => auditTransposeType(reference, name, type, values));

  return {
    arity,
    destinationReplacement: [
      auditTransposeDestination(reference, "empty", () => new reference.Mat()),
      auditTransposeDestination(reference, "correct-metadata", () =>
        makeSeedMat(reference, 3, 2, reference.CV_8UC1, new Uint8Array(6).fill(99)),
      ),
      auditTransposeDestination(reference, "wrong-shape", () =>
        makeSeedMat(reference, 1, 5, reference.CV_8UC1, new Uint8Array(5).fill(99)),
      ),
      auditTransposeDestination(reference, "wrong-type-and-channels", () =>
        makeSeedMat(reference, 3, 2, reference.CV_32FC2, new Float32Array(12).fill(99)),
      ),
    ],
    inPlace: {
      square: auditTransposeInPlace(reference, 3, 3, [1, 2, 3, 4, 5, 6, 7, 8, 9]),
      rectangular: auditTransposeInPlace(reference, 2, 3, [1, 2, 3, 4, 5, 6]),
    },
    roi: [
      auditTransposeRoi(reference, "compatible-separate", [1, 1, 3, 2], [1, 1, 2, 3]),
      auditTransposeRoi(reference, "incompatible-shape-separate", [1, 1, 3, 2], [0, 0, 3, 2]),
      auditTransposeRoi(
        reference,
        "compatible-same-parent-non-overlap",
        [0, 0, 2, 2],
        [3, 2, 2, 2],
        true,
      ),
      auditTransposeRoi(
        reference,
        "compatible-same-parent-overlap",
        [0, 0, 3, 2],
        [1, 0, 2, 3],
        true,
      ),
    ],
    empty,
    deleted: { source: deletedSourceAudit, destination: deletedDestinationAudit },
    types,
    halfFloatConstants: {
      CV_16F: encodeValue(reference.CV_16F),
      CV_16FC1: encodeValue(reference.CV_16FC1),
    },
  };
}

function auditFlipCode(reference, label, value) {
  const source = makeSeedMat(reference, 2, 3, reference.CV_8UC1, [1, 2, 3, 4, 5, 6]);
  const destination = new reference.Mat();
  const result = {
    label,
    input: encodeValue(value),
    audit: auditTransposeCall(
      () => reference.flip(source, destination, value),
      [
        ["source", source],
        ["destination", destination],
      ],
    ),
  };
  safeDelete(destination);
  safeDelete(source);
  return result;
}

function auditFlipDestination(reference, name, createDestination) {
  const source = makeSeedMat(reference, 2, 3, reference.CV_8UC1, [1, 2, 3, 4, 5, 6]);
  const destination = createDestination();
  const result = {
    name,
    audit: auditTransposeCall(
      () => reference.flip(source, destination, 1),
      [
        ["source", source],
        ["destination", destination],
      ],
    ),
  };
  safeDelete(destination);
  safeDelete(source);
  return result;
}

function auditFlipInPlace(reference, code) {
  const matrix = makeSeedMat(reference, 2, 3, reference.CV_8UC1, [1, 2, 3, 4, 5, 6]);
  const result = {
    code,
    audit: auditTransposeCall(() => reference.flip(matrix, matrix, code), [["matrix", matrix]]),
  };
  safeDelete(matrix);
  return result;
}

function auditFlipRoi(reference, name, sourceRect, destinationRect, sameParent, code) {
  const sourceParent = makeSeedMat(
    reference,
    5,
    6,
    reference.CV_8UC1,
    Array.from({ length: 30 }, (_, index) => index + 1),
  );
  const destinationParent = sameParent
    ? sourceParent
    : makeSeedMat(reference, 5, 6, reference.CV_8UC1, new Uint8Array(30).fill(99));
  const source = sourceParent.roi(new reference.Rect(...sourceRect));
  const destination = destinationParent.roi(new reference.Rect(...destinationRect));
  const result = {
    name,
    sameParent,
    code,
    audit: auditTransposeCall(
      () => reference.flip(source, destination, code),
      [
        ["source", source],
        ["destination", destination],
        ["sourceParent", sourceParent],
        ["destinationParent", destinationParent],
      ],
    ),
  };
  safeDelete(destination);
  safeDelete(source);
  if (!sameParent) safeDelete(destinationParent);
  safeDelete(sourceParent);
  return result;
}

function auditFlipTypeRoi(reference) {
  const sourceParent = makeSeedMat(
    reference,
    5,
    6,
    reference.CV_8UC1,
    Array.from({ length: 30 }, (_, index) => index + 1),
  );
  const destinationParent = makeSeedMat(
    reference,
    5,
    6,
    reference.CV_32FC2,
    new Float32Array(60).fill(99),
  );
  const source = sourceParent.roi(new reference.Rect(1, 1, 3, 2));
  const destination = destinationParent.roi(new reference.Rect(1, 1, 3, 2));
  const result = {
    name: "incompatible-type-separate",
    sameParent: false,
    code: 1,
    audit: auditTransposeCall(
      () => reference.flip(source, destination, 1),
      [
        ["source", source],
        ["destination", destination],
        ["sourceParent", sourceParent],
        ["destinationParent", destinationParent],
      ],
    ),
  };
  safeDelete(destination);
  safeDelete(source);
  safeDelete(destinationParent);
  safeDelete(sourceParent);
  return result;
}

function auditFlipType(reference, name, type, values) {
  if (typeof type !== "number") return { name, available: false };
  let source;
  let destination;
  try {
    source = makeSeedMat(reference, 2, 3, type, values);
    destination = new reference.Mat();
    return {
      name,
      available: true,
      audit: auditTypedMatCall(
        () => reference.flip(source, destination, -1),
        [
          ["source", source],
          ["destination", destination],
        ],
      ),
    };
  } catch (error) {
    return {
      name,
      available: true,
      setup: captureCall(() => {
        throw error;
      }),
    };
  } finally {
    safeDelete(destination);
    safeDelete(source);
  }
}

function auditFlip(reference) {
  const source = makeSeedMat(reference, 2, 3, reference.CV_8UC1, [1, 2, 3, 4, 5, 6]);
  const destination = new reference.Mat();
  const arity = {
    functionLength: capturePrimitive(() => reference.flip.length),
    zero: captureCall(() => reference.flip()),
    one: captureCall(() => reference.flip(source)),
    two: captureCall(() => reference.flip(source, destination)),
    three: captureCall(() => reference.flip(source, destination, 1)),
    four: captureCall(() => reference.flip(source, destination, 1, 2)),
    destinationAfter: capturePrimitive(() => summarizeMat(destination)),
  };
  safeDelete(destination);
  safeDelete(source);

  const codes = [
    ["negative two", -2],
    ["negative one", -1],
    ["negative fraction", -1.9],
    ["negative subunit fraction", -0.9],
    ["negative zero", -0],
    ["zero", 0],
    ["positive fraction", 1.9],
    ["positive subunit fraction", 0.9],
    ["one", 1],
    ["two", 2],
    ["i32 maximum", 2_147_483_647],
    ["i32 maximum plus one", 2_147_483_648],
    ["i32 minimum", -2_147_483_648],
    ["i32 minimum minus one", -2_147_483_649],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["true", true],
    ["false", false],
    ["null", null],
    ["numeric string", "1"],
    ["explicit undefined", undefined],
  ].map(([label, value]) => auditFlipCode(reference, label, value));

  const argumentSource = makeSeedMat(reference, 1, 1, reference.CV_8UC1, [1]);
  const argumentDestination = new reference.Mat();
  const argumentTypes = {
    nullSource: captureCall(() => reference.flip(null, argumentDestination, 1)),
    undefinedSource: captureCall(() => reference.flip(undefined, argumentDestination, 1)),
    objectSource: captureCall(() => reference.flip({}, argumentDestination, 1)),
    nullDestination: captureCall(() => reference.flip(argumentSource, null, 1)),
    undefinedDestination: captureCall(() => reference.flip(argumentSource, undefined, 1)),
    objectDestination: captureCall(() => reference.flip(argumentSource, {}, 1)),
  };
  safeDelete(argumentDestination);
  safeDelete(argumentSource);

  const emptySource = new reference.Mat();
  const emptyDestination = new reference.Mat();
  const empty = auditTransposeCall(
    () => reference.flip(emptySource, emptyDestination, 1),
    [
      ["source", emptySource],
      ["destination", emptyDestination],
    ],
  );
  safeDelete(emptyDestination);
  safeDelete(emptySource);

  const secondEmptySource = new reference.Mat();
  const fullEmptyDestination = makeSeedMat(reference, 2, 3, reference.CV_8UC1, [1, 2, 3, 4, 5, 6]);
  const emptyIntoFull = auditTransposeCall(
    () => reference.flip(secondEmptySource, fullEmptyDestination, -1),
    [
      ["source", secondEmptySource],
      ["destination", fullEmptyDestination],
    ],
  );
  safeDelete(fullEmptyDestination);
  safeDelete(secondEmptySource);

  const deletedSource = makeSeedMat(reference, 1, 1, reference.CV_8UC1, [7]);
  const liveDestination = new reference.Mat();
  deletedSource.delete();
  const deletedSourceAudit = auditTransposeCall(
    () => reference.flip(deletedSource, liveDestination, 1),
    [
      ["source", deletedSource],
      ["destination", liveDestination],
    ],
  );
  safeDelete(liveDestination);

  const liveSource = makeSeedMat(reference, 1, 1, reference.CV_8UC1, [8]);
  const deletedDestination = new reference.Mat();
  deletedDestination.delete();
  const deletedDestinationAudit = auditTransposeCall(
    () => reference.flip(liveSource, deletedDestination, 1),
    [
      ["source", liveSource],
      ["destination", deletedDestination],
    ],
  );
  safeDelete(liveSource);

  const types = [
    ["CV_8UC1", reference.CV_8UC1, [1, 2, 3, 4, 5, 6]],
    ["CV_8UC3", reference.CV_8UC3, Array.from({ length: 18 }, (_, index) => index + 1)],
    ["CV_8SC2", reference.CV_8SC2, [-1, 2, -3, 4, -5, 6, -7, 8, -9, 10, -11, 12]],
    ["CV_16UC1", reference.CV_16UC1, [1, 256, 513, 1024, 4096, 65_535]],
    [
      "CV_16SC2",
      reference.CV_16SC2,
      [-1, 2, -300, 400, -500, 600, -700, 800, -900, 1000, -1100, 1200],
    ],
    ["CV_32SC1", reference.CV_32SC1, [-1, 2, -300_000, 400_000, -500_000, 600_000]],
    [
      "CV_32FC2",
      reference.CV_32FC2,
      [-1.5, 2.25, -3.5, 4.75, -5.5, 6.25, -7.5, 8.75, -9.5, 10.25, -11.5, 12.75],
    ],
    ["CV_64FC1", reference.CV_64FC1, [-1.5, 2.25, -3.5, 4.75, -5.5, 6.25]],
    ["CV_16FC1", reference.CV_16FC1, [1, 2, 3, 4, 5, 6]],
  ].map(([name, type, values]) => auditFlipType(reference, name, type, values));

  return {
    arity,
    argumentTypes,
    codes,
    destinationReplacement: [
      auditFlipDestination(reference, "empty", () => new reference.Mat()),
      auditFlipDestination(reference, "correct-metadata", () =>
        makeSeedMat(reference, 2, 3, reference.CV_8UC1, new Uint8Array(6).fill(99)),
      ),
      auditFlipDestination(reference, "wrong-shape", () =>
        makeSeedMat(reference, 3, 2, reference.CV_8UC1, new Uint8Array(6).fill(99)),
      ),
      auditFlipDestination(reference, "wrong-type-and-channels", () =>
        makeSeedMat(reference, 2, 3, reference.CV_32FC2, new Float32Array(12).fill(99)),
      ),
    ],
    inPlace: [-1, 0, 1].map((code) => auditFlipInPlace(reference, code)),
    roi: [
      auditFlipRoi(reference, "compatible-separate", [1, 1, 3, 2], [1, 1, 3, 2], false, 1),
      auditFlipRoi(reference, "incompatible-shape-separate", [1, 1, 3, 2], [0, 0, 2, 3], false, 1),
      auditFlipTypeRoi(reference),
      auditFlipRoi(
        reference,
        "compatible-same-parent-non-overlap",
        [0, 0, 2, 2],
        [3, 2, 2, 2],
        true,
        -1,
      ),
      auditFlipRoi(
        reference,
        "compatible-same-parent-exact-view",
        [0, 0, 3, 2],
        [0, 0, 3, 2],
        true,
        1,
      ),
      auditFlipRoi(
        reference,
        "compatible-same-parent-overlap-horizontal",
        [0, 0, 3, 2],
        [1, 0, 3, 2],
        true,
        1,
      ),
      auditFlipRoi(
        reference,
        "compatible-same-parent-overlap-vertical",
        [0, 0, 3, 3],
        [0, 1, 3, 3],
        true,
        0,
      ),
      auditFlipRoi(
        reference,
        "compatible-same-parent-overlap-both-horizontal-shift",
        [0, 0, 3, 3],
        [1, 0, 3, 3],
        true,
        -1,
      ),
      auditFlipRoi(
        reference,
        "compatible-same-parent-overlap-both-vertical-shift",
        [0, 0, 3, 3],
        [0, 1, 3, 3],
        true,
        -1,
      ),
      auditFlipRoi(
        reference,
        "compatible-same-parent-overlap-both",
        [0, 0, 3, 3],
        [1, 1, 3, 3],
        true,
        -1,
      ),
      auditFlipRoi(
        reference,
        "compatible-same-parent-overlap-both-small-diagonal",
        [0, 0, 2, 2],
        [1, 1, 2, 2],
        true,
        -1,
      ),
    ],
    empty,
    emptyIntoFull,
    deleted: { source: deletedSourceAudit, destination: deletedDestinationAudit },
    types,
    halfFloatConstants: {
      CV_16F: encodeValue(reference.CV_16F),
      CV_16FC1: encodeValue(reference.CV_16FC1),
    },
  };
}

function auditRepeatCounts(reference, axis, label, value, avoidLargeOutput = false) {
  const source = makeSeedMat(reference, 1, 2, reference.CV_8UC1, [1, 2]);
  const destination = makeSeedMat(reference, 2, 2, reference.CV_8UC1, [7, 8, 9, 10]);
  const rowRepeats = axis === "rows" ? value : avoidLargeOutput ? -1 : 1;
  const columnRepeats = axis === "columns" ? value : avoidLargeOutput ? -1 : 1;
  const result = {
    axis,
    label,
    input: encodeValue(value),
    audit: auditTransposeCall(
      () => reference.repeat(source, rowRepeats, columnRepeats, destination),
      [
        ["source", source],
        ["destination", destination],
      ],
    ),
  };
  safeDelete(destination);
  safeDelete(source);
  return result;
}

function auditRepeatDestination(reference, name, createDestination) {
  const source = makeSeedMat(reference, 2, 3, reference.CV_8UC1, [1, 2, 3, 4, 5, 6]);
  const destination = createDestination();
  const result = {
    name,
    audit: auditTransposeCall(
      () => reference.repeat(source, 2, 2, destination),
      [
        ["source", source],
        ["destination", destination],
      ],
    ),
  };
  safeDelete(destination);
  safeDelete(source);
  return result;
}

function auditRepeatRoi(
  reference,
  name,
  sourceRect,
  destinationRect,
  rowRepeats,
  columnRepeats,
  sameParent,
) {
  const sourceParent = makeSeedMat(
    reference,
    6,
    7,
    reference.CV_8UC1,
    Array.from({ length: 42 }, (_, index) => index + 1),
  );
  const destinationParent = sameParent
    ? sourceParent
    : makeSeedMat(reference, 6, 7, reference.CV_8UC1, new Uint8Array(42).fill(99));
  const source = sourceParent.roi(new reference.Rect(...sourceRect));
  const destination = destinationParent.roi(new reference.Rect(...destinationRect));
  const result = {
    name,
    sameParent,
    rowRepeats,
    columnRepeats,
    audit: auditTransposeCall(
      () => reference.repeat(source, rowRepeats, columnRepeats, destination),
      [
        ["source", source],
        ["destination", destination],
        ["sourceParent", sourceParent],
        ["destinationParent", destinationParent],
      ],
    ),
  };
  safeDelete(destination);
  safeDelete(source);
  if (!sameParent) safeDelete(destinationParent);
  safeDelete(sourceParent);
  return result;
}

function auditRepeatTypeRoi(reference) {
  const sourceParent = makeSeedMat(
    reference,
    4,
    5,
    reference.CV_8UC1,
    Array.from({ length: 20 }, (_, index) => index + 1),
  );
  const destinationParent = makeSeedMat(
    reference,
    5,
    5,
    reference.CV_32FC2,
    new Float32Array(50).fill(99),
  );
  const source = sourceParent.roi(new reference.Rect(1, 1, 2, 2));
  const destination = destinationParent.roi(new reference.Rect(1, 1, 2, 4));
  const result = {
    name: "incompatible-type-separate",
    sameParent: false,
    rowRepeats: 2,
    columnRepeats: 1,
    audit: auditTransposeCall(
      () => reference.repeat(source, 2, 1, destination),
      [
        ["source", source],
        ["destination", destination],
        ["sourceParent", sourceParent],
        ["destinationParent", destinationParent],
      ],
    ),
  };
  safeDelete(destination);
  safeDelete(source);
  safeDelete(destinationParent);
  safeDelete(sourceParent);
  return result;
}

function auditRepeatType(reference, name, type, values) {
  if (typeof type !== "number") return { name, available: false };
  let source;
  let destination;
  try {
    source = makeSeedMat(reference, 2, 3, type, values);
    destination = new reference.Mat();
    return {
      name,
      available: true,
      audit: auditTypedMatCall(
        () => reference.repeat(source, 2, 2, destination),
        [
          ["source", source],
          ["destination", destination],
        ],
      ),
    };
  } catch (error) {
    return {
      name,
      available: true,
      setup: captureCall(() => {
        throw error;
      }),
    };
  } finally {
    safeDelete(destination);
    safeDelete(source);
  }
}

function auditRepeat(reference) {
  const aritySource = makeSeedMat(reference, 1, 2, reference.CV_8UC1, [1, 2]);
  const arityDestination = new reference.Mat();
  const arity = {
    functionLength: capturePrimitive(() => reference.repeat.length),
    zero: captureCall(() => reference.repeat()),
    one: captureCall(() => reference.repeat(aritySource)),
    two: captureCall(() => reference.repeat(aritySource, 1)),
    three: captureCall(() => reference.repeat(aritySource, 1, 2)),
    four: captureCall(() => reference.repeat(aritySource, 1, 2, arityDestination)),
    five: captureCall(() => reference.repeat(aritySource, 1, 2, arityDestination, 5)),
    destinationAfter: capturePrimitive(() => summarizeMat(arityDestination)),
  };
  safeDelete(arityDestination);
  safeDelete(aritySource);

  const countInputs = [
    ["negative two", -2],
    ["negative fraction", -1.9],
    ["negative subunit fraction", -0.9],
    ["negative zero", -0],
    ["zero", 0],
    ["positive subunit fraction", 0.9],
    ["positive fraction", 1.9],
    ["one", 1],
    ["two", 2],
    ["i32 maximum", 2_147_483_647, true],
    ["i32 maximum plus one", 2_147_483_648],
    ["i32 minimum", -2_147_483_648],
    ["i32 minimum minus one", -2_147_483_649],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["true", true],
    ["false", false],
    ["null", null],
    ["numeric string", "1"],
    ["explicit undefined", undefined],
  ];
  const counts = ["rows", "columns"].flatMap((axis) =>
    countInputs.map(([label, value, avoidLargeOutput = false]) =>
      auditRepeatCounts(reference, axis, label, value, avoidLargeOutput),
    ),
  );

  const argumentSource = makeSeedMat(reference, 1, 1, reference.CV_8UC1, [1]);
  const argumentDestination = new reference.Mat();
  const argumentTypes = {
    nullSource: captureCall(() => reference.repeat(null, 1, 1, argumentDestination)),
    undefinedSource: captureCall(() => reference.repeat(undefined, 1, 1, argumentDestination)),
    objectSource: captureCall(() => reference.repeat({}, 1, 1, argumentDestination)),
    nullDestination: captureCall(() => reference.repeat(argumentSource, 1, 1, null)),
    undefinedDestination: captureCall(() => reference.repeat(argumentSource, 1, 1, undefined)),
    objectDestination: captureCall(() => reference.repeat(argumentSource, 1, 1, {})),
  };
  safeDelete(argumentDestination);
  safeDelete(argumentSource);

  const emptySource = new reference.Mat();
  const emptyDestination = new reference.Mat();
  const empty = auditTransposeCall(
    () => reference.repeat(emptySource, 2, 3, emptyDestination),
    [
      ["source", emptySource],
      ["destination", emptyDestination],
    ],
  );
  safeDelete(emptyDestination);
  safeDelete(emptySource);

  const secondEmptySource = new reference.Mat();
  const fullEmptyDestination = makeSeedMat(reference, 2, 3, reference.CV_8UC1, [1, 2, 3, 4, 5, 6]);
  const emptyIntoFull = auditTransposeCall(
    () => reference.repeat(secondEmptySource, 2, 3, fullEmptyDestination),
    [
      ["source", secondEmptySource],
      ["destination", fullEmptyDestination],
    ],
  );
  safeDelete(fullEmptyDestination);
  safeDelete(secondEmptySource);

  const deletedSource = makeSeedMat(reference, 1, 1, reference.CV_8UC1, [7]);
  const liveDestination = new reference.Mat();
  deletedSource.delete();
  const deletedSourceAudit = auditTransposeCall(
    () => reference.repeat(deletedSource, 1, 1, liveDestination),
    [
      ["source", deletedSource],
      ["destination", liveDestination],
    ],
  );
  safeDelete(liveDestination);

  const liveSource = makeSeedMat(reference, 1, 1, reference.CV_8UC1, [8]);
  const deletedDestination = new reference.Mat();
  deletedDestination.delete();
  const deletedDestinationAudit = auditTransposeCall(
    () => reference.repeat(liveSource, 1, 1, deletedDestination),
    [
      ["source", liveSource],
      ["destination", deletedDestination],
    ],
  );
  safeDelete(liveSource);

  const sameHandle = makeSeedMat(reference, 2, 2, reference.CV_8UC1, [1, 2, 3, 4]);
  const inPlace = auditTransposeCall(
    () => reference.repeat(sameHandle, 1, 1, sameHandle),
    [["matrix", sameHandle]],
  );
  safeDelete(sameHandle);

  const stridedParent = makeSeedMat(
    reference,
    4,
    5,
    reference.CV_8UC1,
    Array.from({ length: 20 }, (_, index) => index + 1),
  );
  const stridedSource = stridedParent.roi(new reference.Rect(1, 1, 3, 2));
  const stridedDestination = new reference.Mat();
  const strided = auditTransposeCall(
    () => reference.repeat(stridedSource, 2, 2, stridedDestination),
    [
      ["source", stridedSource],
      ["destination", stridedDestination],
      ["sourceParent", stridedParent],
    ],
  );
  safeDelete(stridedDestination);
  safeDelete(stridedSource);
  safeDelete(stridedParent);

  const types = [
    ["CV_8UC1", reference.CV_8UC1, [1, 2, 3, 4, 5, 6]],
    ["CV_8UC3", reference.CV_8UC3, Array.from({ length: 18 }, (_, index) => index + 1)],
    ["CV_8SC2", reference.CV_8SC2, [-1, 2, -3, 4, -5, 6, -7, 8, -9, 10, -11, 12]],
    ["CV_16UC1", reference.CV_16UC1, [1, 256, 513, 1024, 4096, 65_535]],
    [
      "CV_16SC2",
      reference.CV_16SC2,
      [-1, 2, -300, 400, -500, 600, -700, 800, -900, 1000, -1100, 1200],
    ],
    ["CV_32SC1", reference.CV_32SC1, [-1, 2, -300_000, 400_000, -500_000, 600_000]],
    [
      "CV_32FC2",
      reference.CV_32FC2,
      [-1.5, 2.25, -3.5, 4.75, -5.5, 6.25, -7.5, 8.75, -9.5, 10.25, -11.5, 12.75],
    ],
    ["CV_64FC1", reference.CV_64FC1, [-1.5, 2.25, -3.5, 4.75, -5.5, 6.25]],
    ["CV_16FC1", reference.CV_16FC1, [1, 2, 3, 4, 5, 6]],
  ].map(([name, type, values]) => auditRepeatType(reference, name, type, values));

  return {
    arity,
    argumentTypes,
    counts,
    destinationReplacement: [
      auditRepeatDestination(reference, "empty", () => new reference.Mat()),
      auditRepeatDestination(reference, "correct-metadata", () =>
        makeSeedMat(reference, 4, 6, reference.CV_8UC1, new Uint8Array(24).fill(99)),
      ),
      auditRepeatDestination(reference, "wrong-shape", () =>
        makeSeedMat(reference, 2, 6, reference.CV_8UC1, new Uint8Array(12).fill(99)),
      ),
      auditRepeatDestination(reference, "wrong-type-and-channels", () =>
        makeSeedMat(reference, 4, 6, reference.CV_32FC2, new Float32Array(48).fill(99)),
      ),
    ],
    inPlace,
    roi: [
      auditRepeatRoi(reference, "compatible-separate", [1, 1, 2, 2], [1, 1, 4, 2], 1, 2, false),
      auditRepeatRoi(
        reference,
        "incompatible-shape-separate",
        [1, 1, 2, 2],
        [1, 1, 2, 2],
        1,
        2,
        false,
      ),
      auditRepeatTypeRoi(reference),
      auditRepeatRoi(reference, "same-parent-non-overlap", [0, 0, 2, 2], [3, 3, 4, 2], 1, 2, true),
      auditRepeatRoi(
        reference,
        "same-parent-overlap-horizontal",
        [0, 0, 2, 2],
        [1, 0, 4, 2],
        1,
        2,
        true,
      ),
      auditRepeatRoi(
        reference,
        "same-parent-overlap-vertical",
        [0, 0, 2, 2],
        [0, 1, 2, 4],
        2,
        1,
        true,
      ),
      auditRepeatRoi(
        reference,
        "same-parent-overlap-combined",
        [0, 0, 2, 2],
        [1, 1, 4, 4],
        2,
        2,
        true,
      ),
    ],
    empty,
    emptyIntoFull,
    deleted: { source: deletedSourceAudit, destination: deletedDestinationAudit },
    strided,
    types,
    halfFloatConstants: {
      CV_16F: encodeValue(reference.CV_16F),
      CV_16FC1: encodeValue(reference.CV_16FC1),
    },
  };
}

function auditRotateCode(reference, label, value, nativeInvalid = false) {
  const source = makeSeedMat(reference, 2, 3, reference.CV_8UC1, [1, 2, 3, 4, 5, 6]);
  const destination = makeSeedMat(reference, 3, 2, reference.CV_8UC1, [7, 8, 9, 10, 11, 12]);
  const matrices = [
    ["source", source],
    ["destination", destination],
  ];
  const before = Object.fromEntries(
    matrices.map(([name, matrix]) => [name, capturePrimitive(() => summarizeMat(matrix))]),
  );
  const call = captureCall(() => reference.rotate(source, destination, value));
  const result = {
    label,
    input: encodeValue(value),
    nativeInvalid,
    audit: nativeInvalid
      ? { before, call }
      : {
          before,
          call,
          after: Object.fromEntries(
            matrices.map(([name, matrix]) => [name, capturePrimitive(() => summarizeMat(matrix))]),
          ),
        },
  };
  safeDelete(destination);
  safeDelete(source);
  return result;
}

function auditRotateDestination(reference, name, code, createDestination) {
  const source = makeSeedMat(reference, 2, 3, reference.CV_8UC1, [1, 2, 3, 4, 5, 6]);
  const destination = createDestination();
  const result = {
    name,
    code,
    audit: auditTransposeCall(
      () => reference.rotate(source, destination, code),
      [
        ["source", source],
        ["destination", destination],
      ],
    ),
  };
  safeDelete(destination);
  safeDelete(source);
  return result;
}

function auditRotateInPlace(reference, code) {
  const matrix = makeSeedMat(reference, 2, 3, reference.CV_8UC1, [1, 2, 3, 4, 5, 6]);
  const result = {
    code,
    audit: auditTransposeCall(() => reference.rotate(matrix, matrix, code), [["matrix", matrix]]),
  };
  safeDelete(matrix);
  return result;
}

function auditRotateRoi(reference, name, sourceRect, destinationRect, sameParent, code) {
  const sourceParent = makeSeedMat(
    reference,
    6,
    7,
    reference.CV_8UC1,
    Array.from({ length: 42 }, (_, index) => index + 1),
  );
  const destinationParent = sameParent
    ? sourceParent
    : makeSeedMat(reference, 6, 7, reference.CV_8UC1, new Uint8Array(42).fill(99));
  const source = sourceParent.roi(new reference.Rect(...sourceRect));
  const destination = destinationParent.roi(new reference.Rect(...destinationRect));
  const result = {
    name,
    sameParent,
    code,
    audit: auditTransposeCall(
      () => reference.rotate(source, destination, code),
      [
        ["source", source],
        ["destination", destination],
        ["sourceParent", sourceParent],
        ["destinationParent", destinationParent],
      ],
    ),
  };
  safeDelete(destination);
  safeDelete(source);
  if (!sameParent) safeDelete(destinationParent);
  safeDelete(sourceParent);
  return result;
}

function auditRotateTypeRoi(reference) {
  const sourceParent = makeSeedMat(
    reference,
    4,
    5,
    reference.CV_8UC1,
    Array.from({ length: 20 }, (_, index) => index + 1),
  );
  const destinationParent = makeSeedMat(
    reference,
    5,
    5,
    reference.CV_32FC2,
    new Float32Array(50).fill(99),
  );
  const source = sourceParent.roi(new reference.Rect(1, 1, 3, 2));
  const destination = destinationParent.roi(new reference.Rect(1, 1, 2, 3));
  const result = {
    name: "incompatible-type-separate",
    sameParent: false,
    code: 0,
    audit: auditTransposeCall(
      () => reference.rotate(source, destination, 0),
      [
        ["source", source],
        ["destination", destination],
        ["sourceParent", sourceParent],
        ["destinationParent", destinationParent],
      ],
    ),
  };
  safeDelete(destination);
  safeDelete(source);
  safeDelete(destinationParent);
  safeDelete(sourceParent);
  return result;
}

function auditRotateType(reference, name, type, values) {
  if (typeof type !== "number") return { name, available: false };
  let source;
  let destination;
  try {
    source = makeSeedMat(reference, 2, 3, type, values);
    destination = new reference.Mat();
    return {
      name,
      available: true,
      audit: auditTypedMatCall(
        () => reference.rotate(source, destination, 2),
        [
          ["source", source],
          ["destination", destination],
        ],
      ),
    };
  } catch (error) {
    return {
      name,
      available: true,
      setup: captureCall(() => {
        throw error;
      }),
    };
  } finally {
    safeDelete(destination);
    safeDelete(source);
  }
}

function auditRotate(reference) {
  const aritySource = makeSeedMat(reference, 2, 3, reference.CV_8UC1, [1, 2, 3, 4, 5, 6]);
  const arityDestination = new reference.Mat();
  const arity = {
    functionLength: capturePrimitive(() => reference.rotate.length),
    zero: captureCall(() => reference.rotate()),
    one: captureCall(() => reference.rotate(aritySource)),
    two: captureCall(() => reference.rotate(aritySource, arityDestination)),
    three: captureCall(() => reference.rotate(aritySource, arityDestination, 0)),
    four: captureCall(() => reference.rotate(aritySource, arityDestination, 0, 1)),
    destinationAfter: capturePrimitive(() => summarizeMat(arityDestination)),
  };
  safeDelete(arityDestination);
  safeDelete(aritySource);

  const codes = [
    ["negative two", -2, true],
    ["negative one", -1, true],
    ["negative fraction", -1.9, true],
    ["negative subunit fraction", -0.9],
    ["negative zero", -0],
    ["zero", 0],
    ["positive subunit fraction", 0.9],
    ["one", 1],
    ["positive fraction", 1.9],
    ["two", 2],
    ["two fraction", 2.9],
    ["three", 3, true],
    ["i32 maximum", 2_147_483_647, true],
    ["i32 maximum plus one", 2_147_483_648],
    ["i32 minimum", -2_147_483_648, true],
    ["i32 minimum minus one", -2_147_483_649],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["true", true],
    ["false", false],
    ["null", null],
    ["numeric string", "1"],
    ["explicit undefined", undefined],
  ].map(([label, value, nativeInvalid = false]) =>
    auditRotateCode(reference, label, value, nativeInvalid),
  );

  const argumentSource = makeSeedMat(reference, 1, 1, reference.CV_8UC1, [1]);
  const argumentDestination = new reference.Mat();
  const argumentTypes = {
    nullSource: captureCall(() => reference.rotate(null, argumentDestination, 0)),
    undefinedSource: captureCall(() => reference.rotate(undefined, argumentDestination, 0)),
    objectSource: captureCall(() => reference.rotate({}, argumentDestination, 0)),
    nullDestination: captureCall(() => reference.rotate(argumentSource, null, 0)),
    undefinedDestination: captureCall(() => reference.rotate(argumentSource, undefined, 0)),
    objectDestination: captureCall(() => reference.rotate(argumentSource, {}, 0)),
  };
  safeDelete(argumentDestination);
  safeDelete(argumentSource);

  const empty = [0, 1, 2].map((code) => {
    const source = new reference.Mat();
    const destination = new reference.Mat();
    const audit = auditTransposeCall(
      () => reference.rotate(source, destination, code),
      [
        ["source", source],
        ["destination", destination],
      ],
    );
    safeDelete(destination);
    safeDelete(source);
    return { code, audit };
  });
  const emptySource = new reference.Mat();
  const populatedDestination = makeSeedMat(reference, 2, 3, reference.CV_8UC1, [1, 2, 3, 4, 5, 6]);
  const emptyIntoFull = auditTransposeCall(
    () => reference.rotate(emptySource, populatedDestination, 1),
    [
      ["source", emptySource],
      ["destination", populatedDestination],
    ],
  );
  safeDelete(populatedDestination);
  safeDelete(emptySource);

  const deletedSource = makeSeedMat(reference, 1, 1, reference.CV_8UC1, [7]);
  const liveDestination = new reference.Mat();
  deletedSource.delete();
  const deletedSourceAudit = auditTransposeCall(
    () => reference.rotate(deletedSource, liveDestination, 0),
    [
      ["source", deletedSource],
      ["destination", liveDestination],
    ],
  );
  safeDelete(liveDestination);

  const liveSource = makeSeedMat(reference, 1, 1, reference.CV_8UC1, [8]);
  const deletedDestination = new reference.Mat();
  deletedDestination.delete();
  const deletedDestinationAudit = auditTransposeCall(
    () => reference.rotate(liveSource, deletedDestination, 0),
    [
      ["source", liveSource],
      ["destination", deletedDestination],
    ],
  );
  safeDelete(liveSource);

  const stridedParent = makeSeedMat(
    reference,
    4,
    5,
    reference.CV_8UC1,
    Array.from({ length: 20 }, (_, index) => index + 1),
  );
  const stridedSource = stridedParent.roi(new reference.Rect(1, 1, 3, 2));
  const stridedDestination = new reference.Mat();
  const strided = auditTransposeCall(
    () => reference.rotate(stridedSource, stridedDestination, 2),
    [
      ["source", stridedSource],
      ["destination", stridedDestination],
      ["sourceParent", stridedParent],
    ],
  );
  safeDelete(stridedDestination);
  safeDelete(stridedSource);
  safeDelete(stridedParent);

  const types = [
    ["CV_8UC1", reference.CV_8UC1, [1, 2, 3, 4, 5, 6]],
    ["CV_8UC3", reference.CV_8UC3, Array.from({ length: 18 }, (_, index) => index + 1)],
    ["CV_8SC2", reference.CV_8SC2, [-1, 2, -3, 4, -5, 6, -7, 8, -9, 10, -11, 12]],
    ["CV_16UC1", reference.CV_16UC1, [1, 256, 513, 1024, 4096, 65_535]],
    [
      "CV_16SC2",
      reference.CV_16SC2,
      [-1, 2, -300, 400, -500, 600, -700, 800, -900, 1000, -1100, 1200],
    ],
    ["CV_32SC1", reference.CV_32SC1, [-1, 2, -300_000, 400_000, -500_000, 600_000]],
    [
      "CV_32FC2",
      reference.CV_32FC2,
      [-1.5, 2.25, -3.5, 4.75, -5.5, 6.25, -7.5, 8.75, -9.5, 10.25, -11.5, 12.75],
    ],
    ["CV_64FC1", reference.CV_64FC1, [-1.5, 2.25, -3.5, 4.75, -5.5, 6.25]],
    ["CV_16FC1", reference.CV_16FC1, [1, 2, 3, 4, 5, 6]],
  ].map(([name, type, values]) => auditRotateType(reference, name, type, values));

  return {
    constants: {
      ROTATE_90_CLOCKWISE: capturePrimitive(() => reference.ROTATE_90_CLOCKWISE),
      ROTATE_180: capturePrimitive(() => reference.ROTATE_180),
      ROTATE_90_COUNTERCLOCKWISE: capturePrimitive(() => reference.ROTATE_90_COUNTERCLOCKWISE),
    },
    arity,
    argumentTypes,
    codes,
    destinationReplacement: [
      auditRotateDestination(reference, "empty", 0, () => new reference.Mat()),
      auditRotateDestination(reference, "correct-metadata-clockwise", 0, () =>
        makeSeedMat(reference, 3, 2, reference.CV_8UC1, new Uint8Array(6).fill(99)),
      ),
      auditRotateDestination(reference, "correct-metadata-half-turn", 1, () =>
        makeSeedMat(reference, 2, 3, reference.CV_8UC1, new Uint8Array(6).fill(99)),
      ),
      auditRotateDestination(reference, "wrong-shape", 2, () =>
        makeSeedMat(reference, 2, 3, reference.CV_8UC1, new Uint8Array(6).fill(99)),
      ),
      auditRotateDestination(reference, "wrong-type-and-channels", 0, () =>
        makeSeedMat(reference, 3, 2, reference.CV_32FC2, new Float32Array(12).fill(99)),
      ),
    ],
    inPlace: [0, 1, 2].map((code) => auditRotateInPlace(reference, code)),
    roi: [
      auditRotateRoi(reference, "compatible-separate", [1, 1, 3, 2], [1, 1, 2, 3], false, 0),
      auditRotateRoi(
        reference,
        "incompatible-shape-separate",
        [1, 1, 3, 2],
        [1, 1, 3, 2],
        false,
        0,
      ),
      auditRotateTypeRoi(reference),
      auditRotateRoi(reference, "same-parent-non-overlap", [0, 0, 2, 2], [4, 3, 2, 2], true, 0),
      auditRotateRoi(
        reference,
        "same-parent-overlap-clockwise",
        [0, 0, 3, 2],
        [1, 0, 2, 3],
        true,
        0,
      ),
      auditRotateRoi(
        reference,
        "same-parent-overlap-half-turn",
        [0, 0, 3, 2],
        [1, 0, 3, 2],
        true,
        1,
      ),
      auditRotateRoi(
        reference,
        "same-parent-overlap-counterclockwise",
        [0, 0, 3, 2],
        [1, 1, 2, 3],
        true,
        2,
      ),
    ],
    empty,
    emptyIntoFull,
    deleted: { source: deletedSourceAudit, destination: deletedDestinationAudit },
    strided,
    types,
    halfFloatConstants: {
      CV_16F: encodeValue(reference.CV_16F),
      CV_16FC1: encodeValue(reference.CV_16FC1),
    },
  };
}

function auditCountNonZeroType(reference, name, type, values) {
  if (typeof type !== "number") return { name, available: false };
  let source;
  try {
    source = makeSeedMat(reference, 2, 3, type, values);
    return {
      name,
      available: true,
      before: capturePrimitive(() => summarizeTypedMat(source)),
      call: captureCall(() => reference.countNonZero(source)),
      after: capturePrimitive(() => summarizeTypedMat(source)),
    };
  } catch (error) {
    return {
      name,
      available: true,
      setup: captureCall(() => {
        throw error;
      }),
    };
  } finally {
    safeDelete(source);
  }
}

function auditCountNonZero(reference) {
  const source = makeSeedMat(reference, 2, 3, reference.CV_8UC1, [0, 1, 2, 0, 3, 0]);
  const arity = {
    functionLength: capturePrimitive(() => reference.countNonZero.length),
    zero: captureCall(() => reference.countNonZero()),
    one: captureCall(() => reference.countNonZero(source)),
    two: captureCall(() => reference.countNonZero(source, 1)),
    three: captureCall(() => reference.countNonZero(source, 1, 2)),
  };
  const argumentTypes = {
    null: captureCall(() => reference.countNonZero(null)),
    undefined: captureCall(() => reference.countNonZero(undefined)),
    object: captureCall(() => reference.countNonZero({})),
    number: captureCall(() => reference.countNonZero(1)),
    boolean: captureCall(() => reference.countNonZero(true)),
    string: captureCall(() => reference.countNonZero("x")),
  };
  safeDelete(source);

  const empty = new reference.Mat();
  const emptyAudit = {
    before: capturePrimitive(() => summarizeMat(empty)),
    call: captureCall(() => reference.countNonZero(empty)),
    after: capturePrimitive(() => summarizeMat(empty)),
  };
  safeDelete(empty);

  const parent = makeSeedMat(
    reference,
    4,
    5,
    reference.CV_16SC1,
    [0, 1, 0, 2, 0, 3, 0, 0, 4, 0, 0, 5, 0, 0, 6, 7, 0, 8, 0, 9],
  );
  const region = parent.roi(new reference.Rect(1, 1, 3, 2));
  const roi = {
    before: capturePrimitive(() => summarizeTypedMat(region)),
    call: captureCall(() => reference.countNonZero(region)),
    after: capturePrimitive(() => summarizeTypedMat(region)),
    parentAfter: capturePrimitive(() => summarizeTypedMat(parent)),
  };
  safeDelete(region);
  safeDelete(parent);

  const deleted = makeSeedMat(reference, 1, 1, reference.CV_8UC1, [1]);
  deleted.delete();
  const deletedAudit = captureCall(() => reference.countNonZero(deleted));

  const types = [
    ["CV_8UC1", reference.CV_8UC1, [0, 1, 255, 0, 2, 0]],
    ["CV_8SC1", reference.CV_8SC1, [0, -1, 127, -128, 0, 2]],
    ["CV_16UC1", reference.CV_16UC1, [0, 1, 65535, 0, 2, 0]],
    ["CV_16SC1", reference.CV_16SC1, [0, -1, 32767, -32768, 0, 2]],
    ["CV_32SC1", reference.CV_32SC1, [0, -1, 2147483647, -2147483648, 0, 2]],
    [
      "CV_32FC1",
      reference.CV_32FC1,
      [0, -0, 1.401298464324817e-45, Number.NaN, Infinity, -Infinity],
    ],
    ["CV_64FC1", reference.CV_64FC1, [0, -0, Number.MIN_VALUE, Number.NaN, Infinity, -Infinity]],
    ["CV_16FC1", reference.CV_16FC1, [0, -0, 1.5, Number.NaN, Infinity, -Infinity]],
  ].map(([name, type, values]) => auditCountNonZeroType(reference, name, type, values));

  const multiChannel = [
    ["CV_8UC2", reference.CV_8UC2, [0, 1, 2, 0, 0, 3, 4, 0, 0, 5, 6, 0]],
    ["CV_64FC2", reference.CV_64FC2, [0, 1, 2, 0, 0, 3, 4, 0, 0, 5, 6, 0]],
    ["CV_8UC3", reference.CV_8UC3, [0, 1, 2, 0, 0, 3, 4, 0, 0, 5, 6, 0, 7, 0, 8, 0, 9, 0]],
  ].map(([name, type, values]) => auditCountNonZeroType(reference, name, type, values));

  return {
    arity,
    argumentTypes,
    empty: emptyAudit,
    roi,
    deleted: deletedAudit,
    types,
    multiChannel,
  };
}

const FLOAT_UNARY_METHODS = ["exp", "log", "sqrt"];
const FLOAT_INTEGER_TYPES = [
  ["CV_8UC1", "u8", 1, [0, 1, 2, 3, 4, 5]],
  ["CV_8SC1", "i8", 1, [-3, -2, -1, 0, 1, 2]],
  ["CV_16UC1", "u16", 1, [0, 1, 2, 3, 4, 5]],
  ["CV_16SC1", "i16", 1, [-3, -2, -1, 0, 1, 2]],
  ["CV_32SC1", "i32", 1, [-3, -2, -1, 0, 1, 2]],
];
const FLOAT_VALID_TYPES = [
  ["CV_32FC1", "f32", 1, [-1.5, 2.25, -3.5, 4.75, -5.5, 6.25]],
  ["CV_32FC3", "f32", 3, [-1, 2, 3, -4, 5, 6, -7, 8, 9, -10, 11, 12, -13, 14, 15, -16, 17, 18]],
  ["CV_64FC1", "f64", 1, [-1.5, 2.25, -3.5, 4.75, -5.5, 6.25]],
  ["CV_64FC2", "f64", 2, [-1, 2, -3, 4, -5, 6, -7, 8, -9, 10, -11, 12]],
];

function referenceTypeFromName(reference, name) {
  return reference[name];
}

function auditReferenceFloatDestination(reference, method, name, createDestination) {
  const source = makeSeedMat(
    reference,
    2,
    3,
    reference.CV_32FC2,
    [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3],
  );
  const destination = createDestination();
  const audit = auditTypedMatCall(
    () => reference[method](source, destination),
    [
      ["source", source],
      ["destination", destination],
    ],
  );
  safeDelete(destination);
  safeDelete(source);
  return { name, audit };
}

function auditReferenceUnaryRoi(
  reference,
  method,
  name,
  sourceRect,
  destinationRect,
  sameParent,
  destinationType = reference.CV_32FC1,
) {
  const sourceParent = makeSeedMat(
    reference,
    4,
    7,
    reference.CV_32FC1,
    Array.from({ length: 28 }, (_, index) => (index + 1) / 10),
  );
  const destinationParent = sameParent
    ? sourceParent
    : makeSeedMat(
        reference,
        4,
        7,
        destinationType,
        Array.from({ length: 28 }, () => 99),
      );
  const source = sourceParent.roi(new reference.Rect(...sourceRect));
  const destination = destinationParent.roi(new reference.Rect(...destinationRect));
  const audit = auditTypedMatCall(
    () => reference[method](source, destination),
    [
      ["source", source],
      ["destination", destination],
      ["sourceParent", sourceParent],
      ["destinationParent", destinationParent],
    ],
  );
  safeDelete(destination);
  safeDelete(source);
  if (!sameParent) safeDelete(destinationParent);
  safeDelete(sourceParent);
  return { name, sameParent, audit };
}

function auditReferenceUnaryType(reference, method, name, type, values) {
  const source = makeSeedMat(reference, 2, 3, type, values);
  const destination = new reference.Mat();
  const audit = auditTypedMatCall(
    () => reference[method](source, destination),
    [
      ["source", source],
      ["destination", destination],
    ],
  );
  safeDelete(destination);
  safeDelete(source);
  return { name, available: true, audit };
}

function auditReferenceUnary(reference, method) {
  const source = makeSeedMat(reference, 1, 2, reference.CV_32FC1, [1, 4]);
  const destination = new reference.Mat();
  const arity = {
    functionLength: capturePrimitive(() => reference[method].length),
    zero: captureCall(() => reference[method]()),
    one: captureCall(() => reference[method](source)),
    two: captureCall(() => reference[method](source, destination)),
    three: captureCall(() => reference[method](source, destination, 1)),
    destinationAfter: capturePrimitive(() => summarizeTypedMat(destination)),
  };
  const argumentTypes = {
    source: {
      null: captureCall(() => reference[method](null, destination)),
      undefined: captureCall(() => reference[method](undefined, destination)),
      object: captureCall(() => reference[method]({}, destination)),
      number: captureCall(() => reference[method](1, destination)),
      string: captureCall(() => reference[method]("x", destination)),
    },
    destination: {
      null: captureCall(() => reference[method](source, null)),
      undefined: captureCall(() => reference[method](source, undefined)),
      object: captureCall(() => reference[method](source, {})),
      number: captureCall(() => reference[method](source, 1)),
      string: captureCall(() => reference[method](source, "x")),
    },
  };
  safeDelete(destination);
  safeDelete(source);

  const deletedSource = makeSeedMat(reference, 1, 1, reference.CV_32FC1, [1]);
  const liveDestination = new reference.Mat();
  deletedSource.delete();
  const deletedSourceAudit = auditTypedMatCall(
    () => reference[method](deletedSource, liveDestination),
    [
      ["source", deletedSource],
      ["destination", liveDestination],
    ],
  );
  safeDelete(liveDestination);
  const liveSource = makeSeedMat(reference, 1, 1, reference.CV_32FC1, [1]);
  const deletedDestination = new reference.Mat();
  deletedDestination.delete();
  const deletedDestinationAudit = auditTypedMatCall(
    () => reference[method](liveSource, deletedDestination),
    [
      ["source", liveSource],
      ["destination", deletedDestination],
    ],
  );
  safeDelete(liveSource);

  const freshEmptySource = new reference.Mat();
  const freshEmptyDestination = new reference.Mat();
  const freshEmpty = auditTypedMatCall(
    () => reference[method](freshEmptySource, freshEmptyDestination),
    [
      ["source", freshEmptySource],
      ["destination", freshEmptyDestination],
    ],
  );
  safeDelete(freshEmptyDestination);
  safeDelete(freshEmptySource);
  const freshEmptyIntoFullSource = new reference.Mat();
  const populatedDestination = makeSeedMat(reference, 1, 2, reference.CV_32FC1, [7, 8]);
  const freshEmptyIntoFull = auditTypedMatCall(
    () => reference[method](freshEmptyIntoFullSource, populatedDestination),
    [
      ["source", freshEmptyIntoFullSource],
      ["destination", populatedDestination],
    ],
  );
  safeDelete(populatedDestination);
  safeDelete(freshEmptyIntoFullSource);

  const typedEmpty = [
    ["0x0-F32C1", 0, 0, reference.CV_32FC1],
    ["0x3-F32C2", 0, 3, reference.CV_32FC2],
    ["3x0-F64C1", 3, 0, reference.CV_64FC1],
  ].map(([name, rows, columns, type]) => {
    const typedSource = new reference.Mat(rows, columns, type);
    const typedDestination = new reference.Mat();
    const audit = auditTypedMatCall(
      () => reference[method](typedSource, typedDestination),
      [
        ["source", typedSource],
        ["destination", typedDestination],
      ],
    );
    safeDelete(typedDestination);
    safeDelete(typedSource);
    return { name, audit };
  });

  const validTypes = FLOAT_VALID_TYPES.map(([name, , , values]) =>
    auditReferenceUnaryType(
      reference,
      method,
      name,
      referenceTypeFromName(reference, name),
      values,
    ),
  );
  const unsupportedIntegerTypes =
    method === "sqrt"
      ? []
      : FLOAT_INTEGER_TYPES.map(([name, , , values]) =>
          auditReferenceUnaryType(
            reference,
            method,
            name,
            referenceTypeFromName(reference, name),
            values,
          ),
        );
  const numericEdges = [
    [
      "F32",
      reference.CV_32FC1,
      [
        Number.NEGATIVE_INFINITY,
        -4,
        -1.401298464324817e-45,
        -0,
        0,
        1.401298464324817e-45,
        4,
        Number.POSITIVE_INFINITY,
        Number.NaN,
      ],
    ],
    [
      "F64",
      reference.CV_64FC1,
      [
        Number.NEGATIVE_INFINITY,
        -4,
        -Number.MIN_VALUE,
        -0,
        0,
        Number.MIN_VALUE,
        4,
        Number.POSITIVE_INFINITY,
        Number.NaN,
      ],
    ],
  ].map(([name, type, values]) => {
    const edgeSource = makeSeedMat(reference, 1, values.length, type, values);
    const edgeDestination = new reference.Mat();
    const audit = auditTypedMatCall(
      () => reference[method](edgeSource, edgeDestination),
      [
        ["source", edgeSource],
        ["destination", edgeDestination],
      ],
    );
    safeDelete(edgeDestination);
    safeDelete(edgeSource);
    return { name, audit };
  });

  return {
    method,
    arity,
    argumentTypes,
    destinationReplacement: [
      auditReferenceFloatDestination(reference, method, "empty", () => new reference.Mat()),
      auditReferenceFloatDestination(reference, method, "correct-metadata", () =>
        makeSeedMat(
          reference,
          2,
          3,
          reference.CV_32FC2,
          Array.from({ length: 12 }, () => 99),
        ),
      ),
      auditReferenceFloatDestination(reference, method, "wrong-shape", () =>
        makeSeedMat(
          reference,
          3,
          2,
          reference.CV_32FC2,
          Array.from({ length: 12 }, () => 99),
        ),
      ),
      auditReferenceFloatDestination(reference, method, "wrong-type-and-channels", () =>
        makeSeedMat(
          reference,
          2,
          3,
          reference.CV_64FC1,
          Array.from({ length: 6 }, () => 99),
        ),
      ),
    ],
    roi: [
      auditReferenceUnaryRoi(
        reference,
        method,
        "compatible-separate",
        [1, 1, 3, 2],
        [2, 1, 3, 2],
        false,
      ),
      auditReferenceUnaryRoi(
        reference,
        method,
        "incompatible-detach",
        [1, 1, 3, 2],
        [2, 1, 2, 3],
        false,
      ),
      auditReferenceUnaryRoi(
        reference,
        method,
        "wrong-type-detach",
        [1, 1, 3, 2],
        [2, 1, 3, 2],
        false,
        reference.CV_64FC1,
      ),
      auditReferenceUnaryRoi(reference, method, "exact-alias", [1, 1, 3, 2], [1, 1, 3, 2], true),
      auditReferenceUnaryRoi(reference, method, "overlap-right", [0, 1, 3, 2], [1, 1, 3, 2], true),
      auditReferenceUnaryRoi(reference, method, "overlap-down", [1, 0, 3, 2], [1, 1, 3, 2], true),
    ],
    empty: { fresh: freshEmpty, freshIntoFull: freshEmptyIntoFull, typed: typedEmpty },
    deleted: { source: deletedSourceAudit, destination: deletedDestinationAudit },
    validTypes,
    unsupportedIntegerTypes,
    numericEdges,
    excludedUnsafeIntegerTypes: method === "sqrt" ? FLOAT_INTEGER_TYPES.map(([name]) => name) : [],
  };
}

function auditReferencePowCall(reference, power, matrices, source, destination) {
  return auditTypedMatCall(() => reference.pow(source, power, destination), matrices);
}

function auditReferencePowRoi(reference, name, sourceRect, destinationRect, sameParent) {
  const sourceParent = makeSeedMat(
    reference,
    4,
    7,
    reference.CV_32FC1,
    Array.from({ length: 28 }, (_, index) => index + 1),
  );
  const destinationParent = sameParent
    ? sourceParent
    : makeSeedMat(
        reference,
        4,
        7,
        reference.CV_32FC1,
        Array.from({ length: 28 }, () => 99),
      );
  const source = sourceParent.roi(new reference.Rect(...sourceRect));
  const destination = destinationParent.roi(new reference.Rect(...destinationRect));
  const audit = auditReferencePowCall(
    reference,
    2,
    [
      ["source", source],
      ["destination", destination],
      ["sourceParent", sourceParent],
      ["destinationParent", destinationParent],
    ],
    source,
    destination,
  );
  safeDelete(destination);
  safeDelete(source);
  if (!sameParent) safeDelete(destinationParent);
  safeDelete(sourceParent);
  return { name, sameParent, audit };
}

function auditReferencePow(reference) {
  const source = makeSeedMat(reference, 1, 5, reference.CV_64FC1, [4, -4, 0, -0, 2]);
  const destination = new reference.Mat();
  const arity = {
    functionLength: capturePrimitive(() => reference.pow.length),
    zero: captureCall(() => reference.pow()),
    one: captureCall(() => reference.pow(source)),
    two: captureCall(() => reference.pow(source, 2)),
    three: captureCall(() => reference.pow(source, 2, destination)),
    four: captureCall(() => reference.pow(source, 2, destination, 1)),
    destinationAfter: capturePrimitive(() => summarizeTypedMat(destination)),
  };
  const argumentTypes = {
    source: {
      null: captureCall(() => reference.pow(null, 2, destination)),
      undefined: captureCall(() => reference.pow(undefined, 2, destination)),
      object: captureCall(() => reference.pow({}, 2, destination)),
      number: captureCall(() => reference.pow(1, 2, destination)),
      string: captureCall(() => reference.pow("x", 2, destination)),
    },
    power: [
      ["negative-zero", -0],
      ["half", 0.5],
      ["f64-precision", 1.0000000000000002],
      ["NaN", Number.NaN],
      ["positive-infinity", Number.POSITIVE_INFINITY],
      ["negative-infinity", Number.NEGATIVE_INFINITY],
      ["true", true],
      ["false", false],
      ["null", null],
      ["undefined", undefined],
      ["string", "2"],
      ["object", {}],
      ["array", []],
    ].map(([label, power]) => {
      const scalarDestination = new reference.Mat();
      const audit = auditReferencePowCall(
        reference,
        power,
        [
          ["source", source],
          ["destination", scalarDestination],
        ],
        source,
        scalarDestination,
      );
      safeDelete(scalarDestination);
      return { label, audit };
    }),
    destination: {
      null: captureCall(() => reference.pow(source, 2, null)),
      undefined: captureCall(() => reference.pow(source, 2, undefined)),
      object: captureCall(() => reference.pow(source, 2, {})),
      number: captureCall(() => reference.pow(source, 2, 1)),
      string: captureCall(() => reference.pow(source, 2, "x")),
    },
  };
  safeDelete(destination);
  safeDelete(source);

  const destinationReplacement = [
    ["empty", () => new reference.Mat()],
    [
      "correct-metadata",
      () =>
        makeSeedMat(
          reference,
          2,
          3,
          reference.CV_32FC2,
          Array.from({ length: 12 }, () => 99),
        ),
    ],
    [
      "wrong-shape",
      () =>
        makeSeedMat(
          reference,
          3,
          2,
          reference.CV_32FC2,
          Array.from({ length: 12 }, () => 99),
        ),
    ],
    [
      "wrong-type-and-channels",
      () =>
        makeSeedMat(
          reference,
          2,
          3,
          reference.CV_64FC1,
          Array.from({ length: 6 }, () => 99),
        ),
    ],
  ].map(([name, createDestination]) => {
    const replacementSource = makeSeedMat(
      reference,
      2,
      3,
      reference.CV_32FC2,
      [1, -2, 3, -4, 5, -6, 7, -8, 9, -10, 11, -12],
    );
    const replacementDestination = createDestination();
    const audit = auditReferencePowCall(
      reference,
      2,
      [
        ["source", replacementSource],
        ["destination", replacementDestination],
      ],
      replacementSource,
      replacementDestination,
    );
    safeDelete(replacementDestination);
    safeDelete(replacementSource);
    return { name, audit };
  });

  const types = [...FLOAT_INTEGER_TYPES, ...FLOAT_VALID_TYPES].map(([name, , , values]) => {
    const typedSource = makeSeedMat(
      reference,
      2,
      3,
      referenceTypeFromName(reference, name),
      values,
    );
    const typedDestination = new reference.Mat();
    const audit = auditReferencePowCall(
      reference,
      2,
      [
        ["source", typedSource],
        ["destination", typedDestination],
      ],
      typedSource,
      typedDestination,
    );
    safeDelete(typedDestination);
    safeDelete(typedSource);
    return { name, available: true, audit };
  });

  const integerPowers = FLOAT_INTEGER_TYPES.map(([name]) => {
    const signed = name.includes("8S") || name.includes("16S") || name.includes("32S");
    const values = signed ? [-3, -2, -1, 0, 1, 2, 3] : [0, 1, 2, 3, 4];
    return {
      name,
      input: values,
      powers: [0, 1, 2, 3, -1, -2].map((power) => {
        const integerSource = makeSeedMat(
          reference,
          1,
          values.length,
          referenceTypeFromName(reference, name),
          values,
        );
        const integerDestination = new reference.Mat();
        const audit = auditReferencePowCall(
          reference,
          power,
          [
            ["source", integerSource],
            ["destination", integerDestination],
          ],
          integerSource,
          integerDestination,
        );
        safeDelete(integerDestination);
        safeDelete(integerSource);
        return { power, audit };
      }),
    };
  });

  const numericEdges = [
    ["F32", reference.CV_32FC1],
    ["F64", reference.CV_64FC1],
  ].map(([name, type]) => ({
    name,
    powers: [-1, -0.5, -0, 0, 0.5, 1, 2, 3].map((power) => {
      const edgeSource = makeSeedMat(reference, 1, 9, type, [
        Number.NEGATIVE_INFINITY,
        -4,
        -0,
        0,
        4,
        Number.POSITIVE_INFINITY,
        Number.NaN,
        1,
        -1,
      ]);
      const edgeDestination = new reference.Mat();
      const audit = auditReferencePowCall(
        reference,
        power,
        [
          ["source", edgeSource],
          ["destination", edgeDestination],
        ],
        edgeSource,
        edgeDestination,
      );
      safeDelete(edgeDestination);
      safeDelete(edgeSource);
      return { power: encodeValue(power), audit };
    }),
  }));

  const emptySource = new reference.Mat();
  const emptyDestination = new reference.Mat();
  const freshEmpty = auditReferencePowCall(
    reference,
    2,
    [
      ["source", emptySource],
      ["destination", emptyDestination],
    ],
    emptySource,
    emptyDestination,
  );
  safeDelete(emptyDestination);
  safeDelete(emptySource);
  const emptyIntoFullSource = new reference.Mat();
  const fullDestination = makeSeedMat(reference, 1, 2, reference.CV_32FC1, [7, 8]);
  const freshEmptyIntoFull = auditReferencePowCall(
    reference,
    2,
    [
      ["source", emptyIntoFullSource],
      ["destination", fullDestination],
    ],
    emptyIntoFullSource,
    fullDestination,
  );
  safeDelete(fullDestination);
  safeDelete(emptyIntoFullSource);

  const deletedSource = makeSeedMat(reference, 1, 1, reference.CV_32FC1, [1]);
  const liveDestination = new reference.Mat();
  deletedSource.delete();
  const deletedSourceAudit = auditReferencePowCall(
    reference,
    2,
    [
      ["source", deletedSource],
      ["destination", liveDestination],
    ],
    deletedSource,
    liveDestination,
  );
  safeDelete(liveDestination);
  const liveSource = makeSeedMat(reference, 1, 1, reference.CV_32FC1, [1]);
  const deletedDestination = new reference.Mat();
  deletedDestination.delete();
  const deletedDestinationAudit = auditReferencePowCall(
    reference,
    2,
    [
      ["source", liveSource],
      ["destination", deletedDestination],
    ],
    liveSource,
    deletedDestination,
  );
  safeDelete(liveSource);

  return {
    arity,
    argumentTypes,
    destinationReplacement,
    roi: [
      auditReferencePowRoi(reference, "compatible-separate", [1, 1, 3, 2], [2, 1, 3, 2], false),
      auditReferencePowRoi(reference, "incompatible-detach", [1, 1, 3, 2], [2, 1, 2, 3], false),
      auditReferencePowRoi(reference, "exact-alias", [1, 1, 3, 2], [1, 1, 3, 2], true),
      auditReferencePowRoi(reference, "overlap-right", [0, 1, 3, 2], [1, 1, 3, 2], true),
      auditReferencePowRoi(reference, "overlap-down", [1, 0, 3, 2], [1, 1, 3, 2], true),
    ],
    empty: { fresh: freshEmpty, freshIntoFull: freshEmptyIntoFull },
    deleted: { source: deletedSourceAudit, destination: deletedDestinationAudit },
    types,
    integerPowers,
    numericEdges,
    excludedUnsafeIntegerPowers: ["fractional", "NaN", "positive-infinity", "negative-infinity"],
  };
}

function auditReferenceMagnitudeRoi(reference, name, aliasInput, sourceRect, destinationRect) {
  const aliasParent = makeSeedMat(
    reference,
    4,
    7,
    reference.CV_32FC1,
    Array.from({ length: 28 }, (_, index) => index + 1),
  );
  const other = makeSeedMat(reference, 2, 3, reference.CV_32FC1, [0, 0, 0, 0, 0, 0]);
  const aliasedInput = aliasParent.roi(new reference.Rect(...sourceRect));
  const destination = aliasParent.roi(new reference.Rect(...destinationRect));
  const x = aliasInput === "x" ? aliasedInput : other;
  const y = aliasInput === "y" ? aliasedInput : other;
  const audit = auditTypedMatCall(
    () => reference.magnitude(x, y, destination),
    [
      ["x", x],
      ["y", y],
      ["destination", destination],
      ["aliasParent", aliasParent],
    ],
  );
  safeDelete(destination);
  safeDelete(aliasedInput);
  safeDelete(other);
  safeDelete(aliasParent);
  return { name, aliasInput, audit };
}

function auditReferenceMagnitude(reference) {
  const x = makeSeedMat(reference, 1, 2, reference.CV_32FC1, [3, 4]);
  const y = makeSeedMat(reference, 1, 2, reference.CV_32FC1, [4, 3]);
  const destination = new reference.Mat();
  const arity = {
    functionLength: capturePrimitive(() => reference.magnitude.length),
    zero: captureCall(() => reference.magnitude()),
    one: captureCall(() => reference.magnitude(x)),
    two: captureCall(() => reference.magnitude(x, y)),
    three: captureCall(() => reference.magnitude(x, y, destination)),
    four: captureCall(() => reference.magnitude(x, y, destination, 1)),
    destinationAfter: capturePrimitive(() => summarizeTypedMat(destination)),
  };
  const invalidMat = (position, value) =>
    captureCall(() =>
      reference.magnitude(
        position === "x" ? value : x,
        position === "y" ? value : y,
        position === "destination" ? value : destination,
      ),
    );
  const argumentTypes = Object.fromEntries(
    ["x", "y", "destination"].map((position) => [
      position,
      Object.fromEntries(
        [
          ["null", null],
          ["undefined", undefined],
          ["object", {}],
          ["number", 1],
          ["string", "x"],
        ].map(([name, value]) => [name, invalidMat(position, value)]),
      ),
    ]),
  );
  safeDelete(destination);
  safeDelete(y);
  safeDelete(x);

  const destinationReplacement = [
    ["empty", () => new reference.Mat()],
    [
      "correct-metadata",
      () =>
        makeSeedMat(
          reference,
          2,
          3,
          reference.CV_32FC1,
          Array.from({ length: 6 }, () => 99),
        ),
    ],
    [
      "wrong-shape",
      () =>
        makeSeedMat(
          reference,
          3,
          2,
          reference.CV_32FC1,
          Array.from({ length: 6 }, () => 99),
        ),
    ],
    [
      "wrong-type-and-channels",
      () =>
        makeSeedMat(
          reference,
          2,
          3,
          reference.CV_64FC2,
          Array.from({ length: 12 }, () => 99),
        ),
    ],
  ].map(([name, createDestination]) => {
    const left = makeSeedMat(reference, 2, 3, reference.CV_32FC1, [1, -2, 3, -4, 5, -6]);
    const right = makeSeedMat(reference, 2, 3, reference.CV_32FC1, [6, 5, 4, 3, 2, 1]);
    const output = createDestination();
    const audit = auditTypedMatCall(
      () => reference.magnitude(left, right, output),
      [
        ["x", left],
        ["y", right],
        ["destination", output],
      ],
    );
    safeDelete(output);
    safeDelete(right);
    safeDelete(left);
    return { name, audit };
  });

  const validTypes = FLOAT_VALID_TYPES.map(([name, , , values]) => {
    const type = referenceTypeFromName(reference, name);
    const left = makeSeedMat(reference, 2, 3, type, values);
    const right = makeSeedMat(
      reference,
      2,
      3,
      type,
      values.map((value) => Math.abs(value) + 1),
    );
    const output = new reference.Mat();
    const audit = auditTypedMatCall(
      () => reference.magnitude(left, right, output),
      [
        ["x", left],
        ["y", right],
        ["destination", output],
      ],
    );
    safeDelete(output);
    safeDelete(right);
    safeDelete(left);
    return { name, available: true, audit };
  });
  const unsupportedIntegerTypes = FLOAT_INTEGER_TYPES.map(([name, , , values]) => {
    const type = referenceTypeFromName(reference, name);
    const left = makeSeedMat(reference, 2, 3, type, values);
    const right = makeSeedMat(
      reference,
      2,
      3,
      type,
      values.map((value) => Math.abs(value) + 1),
    );
    const output = new reference.Mat();
    const audit = auditTypedMatCall(
      () => reference.magnitude(left, right, output),
      [
        ["x", left],
        ["y", right],
        ["destination", output],
      ],
    );
    safeDelete(output);
    safeDelete(right);
    safeDelete(left);
    return { name, audit };
  });

  const mismatchBase = makeSeedMat(reference, 2, 2, reference.CV_32FC1, [1, 2, 3, 4]);
  const mismatches = [
    ["shape", makeSeedMat(reference, 1, 4, reference.CV_32FC1, [1, 2, 3, 4])],
    ["depth", makeSeedMat(reference, 2, 2, reference.CV_64FC1, [1, 2, 3, 4])],
    ["channels", makeSeedMat(reference, 2, 2, reference.CV_32FC2, [1, 2, 3, 4, 5, 6, 7, 8])],
    ["empty", new reference.Mat()],
  ].map(([name, right]) => {
    const output = new reference.Mat();
    const audit = auditTypedMatCall(
      () => reference.magnitude(mismatchBase, right, output),
      [
        ["x", mismatchBase],
        ["y", right],
        ["destination", output],
      ],
    );
    safeDelete(output);
    safeDelete(right);
    return { name, audit };
  });
  safeDelete(mismatchBase);

  const numericEdges = [
    [
      "F32",
      reference.CV_32FC1,
      [
        0,
        -0,
        3,
        -3,
        3.4028234663852886e38,
        3.4028234663852886e38,
        1.1754943508222875e-38,
        1.401298464324817e-45,
        Infinity,
        -Infinity,
        NaN,
        1,
        Infinity,
        NaN,
      ],
      [
        0,
        0,
        4,
        4,
        0,
        3.4028234663852886e38,
        0,
        1.401298464324817e-45,
        1,
        Infinity,
        1,
        NaN,
        NaN,
        Infinity,
      ],
    ],
    [
      "F64",
      reference.CV_64FC1,
      [
        0,
        -0,
        3,
        -3,
        Number.MAX_VALUE,
        Number.MAX_VALUE,
        Number.MIN_VALUE,
        2.2250738585072014e-308,
        Infinity,
        -Infinity,
        NaN,
        1,
        Infinity,
        NaN,
      ],
      [0, 0, 4, 4, 0, Number.MAX_VALUE, 0, Number.MIN_VALUE, 1, Infinity, 1, NaN, NaN, Infinity],
    ],
  ].map(([name, type, xValues, yValues]) => {
    const left = makeSeedMat(reference, 1, xValues.length, type, xValues);
    const right = makeSeedMat(reference, 1, yValues.length, type, yValues);
    const output = new reference.Mat();
    const audit = auditTypedMatCall(
      () => reference.magnitude(left, right, output),
      [
        ["x", left],
        ["y", right],
        ["destination", output],
      ],
    );
    safeDelete(output);
    safeDelete(right);
    safeDelete(left);
    return { name, audit };
  });

  const emptyX = new reference.Mat();
  const emptyY = new reference.Mat();
  const emptyDestination = new reference.Mat();
  const empty = auditTypedMatCall(
    () => reference.magnitude(emptyX, emptyY, emptyDestination),
    [
      ["x", emptyX],
      ["y", emptyY],
      ["destination", emptyDestination],
    ],
  );
  safeDelete(emptyDestination);
  safeDelete(emptyY);
  safeDelete(emptyX);

  const deletedX = makeSeedMat(reference, 1, 1, reference.CV_32FC1, [1]);
  const liveY = makeSeedMat(reference, 1, 1, reference.CV_32FC1, [2]);
  const liveOutput = new reference.Mat();
  deletedX.delete();
  const deletedXAudit = auditTypedMatCall(
    () => reference.magnitude(deletedX, liveY, liveOutput),
    [
      ["x", deletedX],
      ["y", liveY],
      ["destination", liveOutput],
    ],
  );
  safeDelete(liveOutput);
  safeDelete(liveY);
  const liveX = makeSeedMat(reference, 1, 1, reference.CV_32FC1, [1]);
  const deletedY = makeSeedMat(reference, 1, 1, reference.CV_32FC1, [2]);
  const secondOutput = new reference.Mat();
  deletedY.delete();
  const deletedYAudit = auditTypedMatCall(
    () => reference.magnitude(liveX, deletedY, secondOutput),
    [
      ["x", liveX],
      ["y", deletedY],
      ["destination", secondOutput],
    ],
  );
  safeDelete(secondOutput);
  safeDelete(liveX);
  const thirdX = makeSeedMat(reference, 1, 1, reference.CV_32FC1, [1]);
  const thirdY = makeSeedMat(reference, 1, 1, reference.CV_32FC1, [2]);
  const deletedOutput = new reference.Mat();
  deletedOutput.delete();
  const deletedDestinationAudit = auditTypedMatCall(
    () => reference.magnitude(thirdX, thirdY, deletedOutput),
    [
      ["x", thirdX],
      ["y", thirdY],
      ["destination", deletedOutput],
    ],
  );
  safeDelete(thirdY);
  safeDelete(thirdX);

  return {
    arity,
    argumentTypes,
    destinationReplacement,
    aliases: [
      auditReferenceMagnitudeRoi(reference, "exact-x", "x", [1, 1, 3, 2], [1, 1, 3, 2]),
      auditReferenceMagnitudeRoi(reference, "exact-y", "y", [1, 1, 3, 2], [1, 1, 3, 2]),
      auditReferenceMagnitudeRoi(reference, "x-overlap-right", "x", [0, 1, 3, 2], [1, 1, 3, 2]),
      auditReferenceMagnitudeRoi(reference, "x-overlap-down", "x", [1, 0, 3, 2], [1, 1, 3, 2]),
      auditReferenceMagnitudeRoi(reference, "y-overlap-right", "y", [0, 1, 3, 2], [1, 1, 3, 2]),
      auditReferenceMagnitudeRoi(reference, "y-overlap-down", "y", [1, 0, 3, 2], [1, 1, 3, 2]),
    ],
    empty,
    deleted: { x: deletedXAudit, y: deletedYAudit, destination: deletedDestinationAudit },
    validTypes,
    unsupportedIntegerTypes,
    mismatches,
    numericEdges,
  };
}

function auditFloatMath(reference) {
  return {
    unary: Object.fromEntries(
      FLOAT_UNARY_METHODS.map((method) => [method, auditReferenceUnary(reference, method)]),
    ),
    pow: auditReferencePow(reference),
    magnitude: auditReferenceMagnitude(reference),
    halfFloatConstants: {
      CV_16F: encodeValue(reference.CV_16F),
      CV_16FC1: encodeValue(reference.CV_16FC1),
    },
  };
}

function auditCoordinateConversions(reference) {
  const makeF32 = (values) => makeSeedMat(reference, 1, values.length, reference.CV_32FC1, values);
  const captureCart = (arguments_) => captureCall(() => reference.cartToPolar(...arguments_));
  const capturePolar = (arguments_) => captureCall(() => reference.polarToCart(...arguments_));
  const x = makeF32([1, 0, -1, 0]);
  const y = makeF32([0, 1, 0, -1]);
  const magnitude = new reference.Mat();
  const angle = new reference.Mat();
  const cartArity = {
    functionLength: capturePrimitive(() => reference.cartToPolar.length),
    zero: captureCart([]),
    one: captureCart([x]),
    two: captureCart([x, y]),
    three: captureCart([x, y, magnitude]),
    four: captureCart([x, y, magnitude, angle]),
    five: captureCart([x, y, magnitude, angle, true]),
    six: captureCart([x, y, magnitude, angle, true, 1]),
    magnitude: capturePrimitive(() => summarizeTypedMat(magnitude)),
    angle: capturePrimitive(() => summarizeTypedMat(angle)),
  };
  safeDelete(angle);
  safeDelete(magnitude);
  safeDelete(y);
  safeDelete(x);

  const flagCases = [
    ["false", false],
    ["true", true],
    ["zero", 0],
    ["one", 1],
    ["empty-string", ""],
    ["string", "x"],
    ["null", null],
    ["undefined", undefined],
    ["NaN", Number.NaN],
  ].map(([name, flag]) => {
    const flagX = makeF32([0, 0]);
    const flagY = makeF32([1, -1]);
    const flagMagnitude = new reference.Mat();
    const flagAngle = new reference.Mat();
    const audit = auditTypedMatCall(
      () => reference.cartToPolar(flagX, flagY, flagMagnitude, flagAngle, flag),
      [
        ["x", flagX],
        ["y", flagY],
        ["magnitude", flagMagnitude],
        ["angle", flagAngle],
      ],
    );
    safeDelete(flagAngle);
    safeDelete(flagMagnitude);
    safeDelete(flagY);
    safeDelete(flagX);
    return { name, audit };
  });

  const polarMagnitude = makeF32([1, 1, 1, 1]);
  const polarAngle = makeF32([0, 90, 180, 270]);
  const outputX = new reference.Mat();
  const outputY = new reference.Mat();
  const polarArity = {
    functionLength: capturePrimitive(() => reference.polarToCart.length),
    zero: capturePolar([]),
    one: capturePolar([polarMagnitude]),
    two: capturePolar([polarMagnitude, polarAngle]),
    three: capturePolar([polarMagnitude, polarAngle, outputX]),
    four: capturePolar([polarMagnitude, polarAngle, outputX, outputY]),
    five: capturePolar([polarMagnitude, polarAngle, outputX, outputY, true]),
    six: capturePolar([polarMagnitude, polarAngle, outputX, outputY, true, 1]),
    x: capturePrimitive(() => summarizeTypedMat(outputX)),
    y: capturePrimitive(() => summarizeTypedMat(outputY)),
  };
  safeDelete(outputY);
  safeDelete(outputX);
  safeDelete(polarAngle);
  safeDelete(polarMagnitude);

  const replacementX = makeF32([3, 0, -4, 0]);
  const replacementY = makeF32([4, 2, 0, -5]);
  const replacementMagnitude = makeSeedMat(
    reference,
    2,
    2,
    reference.CV_64FC2,
    [99, 99, 99, 99, 99, 99, 99, 99],
  );
  const replacementAngle = makeSeedMat(reference, 2, 2, reference.CV_8UC1, [99, 99, 99, 99]);
  const replacement = auditTypedMatCall(
    () => reference.cartToPolar(replacementX, replacementY, replacementMagnitude, replacementAngle),
    [
      ["x", replacementX],
      ["y", replacementY],
      ["magnitude", replacementMagnitude],
      ["angle", replacementAngle],
    ],
  );
  safeDelete(replacementAngle);
  safeDelete(replacementMagnitude);
  safeDelete(replacementY);
  safeDelete(replacementX);

  const emptyX = new reference.Mat();
  const emptyY = new reference.Mat();
  const emptyMagnitude = makeF32([9]);
  const emptyAngle = makeF32([9]);
  const empty = auditTypedMatCall(
    () => reference.cartToPolar(emptyX, emptyY, emptyMagnitude, emptyAngle),
    [
      ["x", emptyX],
      ["y", emptyY],
      ["magnitude", emptyMagnitude],
      ["angle", emptyAngle],
    ],
  );
  safeDelete(emptyAngle);
  safeDelete(emptyMagnitude);
  safeDelete(emptyY);
  safeDelete(emptyX);

  const cartAliasParent = makeF32([2, 3, 4, 99]);
  const cartAliasX = cartAliasParent.roi(new reference.Rect(0, 0, 3, 1));
  const cartAliasY = makeF32([0, 0, 0]);
  const cartAliasMagnitude = cartAliasParent.roi(new reference.Rect(1, 0, 3, 1));
  const cartAliasAngle = new reference.Mat();
  const cartOverlap = auditTypedMatCall(
    () => reference.cartToPolar(cartAliasX, cartAliasY, cartAliasMagnitude, cartAliasAngle),
    [
      ["parent", cartAliasParent],
      ["x", cartAliasX],
      ["y", cartAliasY],
      ["magnitude", cartAliasMagnitude],
      ["angle", cartAliasAngle],
    ],
  );
  safeDelete(cartAliasAngle);
  safeDelete(cartAliasMagnitude);
  safeDelete(cartAliasY);
  safeDelete(cartAliasX);
  safeDelete(cartAliasParent);

  const polarAliasParent = makeF32([2, 3, 4, 99]);
  const polarAliasMagnitude = polarAliasParent.roi(new reference.Rect(0, 0, 3, 1));
  const polarAliasAngle = makeF32([0, 0, 0]);
  const polarAliasX = polarAliasParent.roi(new reference.Rect(1, 0, 3, 1));
  const polarAliasY = new reference.Mat();
  const polarOverlap = auditTypedMatCall(
    () => reference.polarToCart(polarAliasMagnitude, polarAliasAngle, polarAliasX, polarAliasY),
    [
      ["parent", polarAliasParent],
      ["magnitude", polarAliasMagnitude],
      ["angle", polarAliasAngle],
      ["x", polarAliasX],
      ["y", polarAliasY],
    ],
  );
  safeDelete(polarAliasY);
  safeDelete(polarAliasX);
  safeDelete(polarAliasAngle);
  safeDelete(polarAliasMagnitude);
  safeDelete(polarAliasParent);

  const sharedOutputX = makeF32([3, 0]);
  const sharedOutputY = makeF32([4, -2]);
  const sharedOutput = new reference.Mat();
  const cartSharedOutput = auditTypedMatCall(
    () => reference.cartToPolar(sharedOutputX, sharedOutputY, sharedOutput, sharedOutput),
    [
      ["x", sharedOutputX],
      ["y", sharedOutputY],
      ["output", sharedOutput],
    ],
  );
  safeDelete(sharedOutput);
  safeDelete(sharedOutputY);
  safeDelete(sharedOutputX);

  const typeCases = [
    ["CV_32FC3", reference.CV_32FC3, [1, 2, 3, 4, 5, 6]],
    ["CV_64FC2", reference.CV_64FC2, [1, 2, 3, 4]],
    ["CV_8UC1", reference.CV_8UC1, [1, 2]],
  ].map(([name, type, values]) => {
    const typeX = makeSeedMat(reference, 1, 2, type, values);
    const typeY = makeSeedMat(reference, 1, 2, type, values);
    const typeMagnitude = new reference.Mat();
    const typeAngle = new reference.Mat();
    const audit = auditTypedMatCall(
      () => reference.cartToPolar(typeX, typeY, typeMagnitude, typeAngle),
      [
        ["x", typeX],
        ["y", typeY],
        ["magnitude", typeMagnitude],
        ["angle", typeAngle],
      ],
    );
    safeDelete(typeAngle);
    safeDelete(typeMagnitude);
    safeDelete(typeY);
    safeDelete(typeX);
    return { name, audit };
  });

  const typedEmptyCases = [
    ["zero-by-three", 0, 3],
    ["three-by-zero", 3, 0],
    ["zero-by-zero", 0, 0],
  ].map(([name, rows, cols]) => {
    const typedX = new reference.Mat(rows, cols, reference.CV_32FC1);
    const typedY = new reference.Mat(rows, cols, reference.CV_32FC1);
    const typedMagnitude = makeF32([9]);
    const typedAngle = makeF32([9]);
    const audit = auditTypedMatCall(
      () => reference.cartToPolar(typedX, typedY, typedMagnitude, typedAngle),
      [
        ["x", typedX],
        ["y", typedY],
        ["magnitude", typedMagnitude],
        ["angle", typedAngle],
      ],
    );
    safeDelete(typedAngle);
    safeDelete(typedMagnitude);
    safeDelete(typedY);
    safeDelete(typedX);
    return { name, audit };
  });

  const preciseCartX = makeSeedMat(reference, 1, 4, reference.CV_64FC1, [
    1.0000000001,
    Math.PI,
    1e200,
    1e-200,
  ]);
  const preciseCartY = makeSeedMat(reference, 1, 4, reference.CV_64FC1, [
    1.0000000002,
    Math.E,
    0,
    1e-200,
  ]);
  const preciseCartMagnitude = new reference.Mat();
  const preciseCartAngle = new reference.Mat();
  const preciseCart = auditTypedMatCall(
    () => reference.cartToPolar(preciseCartX, preciseCartY, preciseCartMagnitude, preciseCartAngle),
    [
      ["x", preciseCartX],
      ["y", preciseCartY],
      ["magnitude", preciseCartMagnitude],
      ["angle", preciseCartAngle],
    ],
  );
  safeDelete(preciseCartAngle);
  safeDelete(preciseCartMagnitude);
  safeDelete(preciseCartY);
  safeDelete(preciseCartX);

  const precisePolarMagnitude = makeSeedMat(reference, 1, 4, reference.CV_64FC1, [
    1.0000000001,
    Math.PI,
    1e200,
    1e-200,
  ]);
  const precisePolarAngle = makeSeedMat(
    reference,
    1,
    4,
    reference.CV_64FC1,
    [0.1234567890123, -0.75, 7, 1e-10],
  );
  const precisePolarX = new reference.Mat();
  const precisePolarY = new reference.Mat();
  const precisePolar = auditTypedMatCall(
    () =>
      reference.polarToCart(precisePolarMagnitude, precisePolarAngle, precisePolarX, precisePolarY),
    [
      ["magnitude", precisePolarMagnitude],
      ["angle", precisePolarAngle],
      ["x", precisePolarX],
      ["y", precisePolarY],
    ],
  );
  safeDelete(precisePolarY);
  safeDelete(precisePolarX);
  safeDelete(precisePolarAngle);
  safeDelete(precisePolarMagnitude);

  return {
    cartArity,
    polarArity,
    flagCases,
    replacement,
    empty,
    aliases: { cartOverlap, polarOverlap, cartSharedOutput },
    typeCases,
    typedEmptyCases,
    preciseCart,
    precisePolar,
  };
}

function encodeValue(value) {
  if (value === undefined) {
    return { type: "undefined" };
  }
  if (value === null) {
    return { type: "null" };
  }
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return { type: "nan" };
    }
    if (value === Number.POSITIVE_INFINITY) {
      return { type: "positive-infinity" };
    }
    if (value === Number.NEGATIVE_INFINITY) {
      return { type: "negative-infinity" };
    }
    if (Object.is(value, -0)) {
      return { type: "negative-zero" };
    }
    return { type: "number", value };
  }
  return { type: typeof value, value };
}

function captureCall(callback) {
  try {
    return { threw: false, returnValue: encodeValue(callback()) };
  } catch (error) {
    return {
      threw: true,
      error: {
        name: error?.name,
        constructor: error?.constructor?.name,
        message: error?.message,
        text: String(error),
        instanceofError: error instanceof Error,
      },
    };
  }
}

function captureEnumCall(callback, namespace, constants) {
  try {
    return {
      threw: false,
      returnValue: describeEnumValue(callback(), namespace, constants),
    };
  } catch (error) {
    return {
      threw: true,
      error: {
        name: error?.name,
        constructor: error?.constructor?.name,
        message: error?.message,
        text: String(error),
        instanceofError: error instanceof Error,
      },
    };
  }
}

function capturePrimitive(callback) {
  try {
    return { threw: false, value: encodeValue(callback()) };
  } catch (error) {
    return {
      threw: true,
      error: {
        name: error?.name,
        constructor: error?.constructor?.name,
        message: error?.message,
        text: String(error),
        instanceofError: error instanceof Error,
      },
    };
  }
}

function propertyDescriptorSummary(owner, property) {
  const descriptor = Object.getOwnPropertyDescriptor(owner, property);
  if (descriptor === undefined) return { present: false };
  return {
    present: true,
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,
    writable: descriptor.writable,
    hasGetter: descriptor.get !== undefined,
    hasSetter: descriptor.set !== undefined,
    valueType: descriptor.value === null ? "null" : typeof descriptor.value,
    functionName: typeof descriptor.value === "function" ? descriptor.value.name : undefined,
  };
}

function describeEnumValue(value, namespace, constants) {
  const isObject = (typeof value === "object" && value !== null) || typeof value === "function";
  return {
    encoded: encodeValue(isObject ? undefined : value),
    type: typeof value,
    isNull: value === null,
    value: isObject ? capturePrimitive(() => value.value) : undefined,
    objectKeys: isObject ? Object.keys(value).toSorted() : [],
    ownNames: isObject ? Object.getOwnPropertyNames(value).toSorted() : [],
    ownSymbolDescriptions: isObject
      ? Object.getOwnPropertySymbols(value)
          .map((symbol) => symbol.description ?? "")
          .toSorted()
      : [],
    valueDescriptor: isObject ? propertyDescriptorSummary(value, "value") : undefined,
    constructorDescriptor: isObject ? propertyDescriptorSummary(value, "constructor") : undefined,
    prototypeIsNamespacePrototype: isObject
      ? Object.getPrototypeOf(value) === namespace.prototype
      : false,
    instanceOfNamespace: isObject ? value instanceof namespace : false,
    constructorName: isObject ? capturePrimitive(() => value.constructor?.name) : undefined,
    objectTag: isObject ? capturePrimitive(() => Object.prototype.toString.call(value)) : undefined,
    string: capturePrimitive(() => String(value)),
    number: capturePrimitive(() => Number(value)),
    json: capturePrimitive(() => JSON.stringify(value)),
    extensible: isObject ? Object.isExtensible(value) : false,
    sealed: isObject ? Object.isSealed(value) : false,
    frozen: isObject ? Object.isFrozen(value) : false,
    matchingConstants: constants.filter(([, constant]) => value === constant).map(([name]) => name),
  };
}

function summarizeEnumNamespace(name, namespace, constantNames) {
  const constants = constantNames.map((constantName) => [constantName, namespace[constantName]]);
  const values = namespace.values;
  return {
    name,
    type: typeof namespace,
    ownKeys: Object.keys(namespace).toSorted(),
    ownNames: Object.getOwnPropertyNames(namespace).toSorted(),
    prototypeOwnNames: Object.getOwnPropertyNames(namespace.prototype).toSorted(),
    descriptors: Object.fromEntries(
      constantNames.map((constantName) => [
        constantName,
        propertyDescriptorSummary(namespace, constantName),
      ]),
    ),
    constants: Object.fromEntries(
      constants.map(([constantName, value]) => [
        constantName,
        describeEnumValue(value, namespace, constants),
      ]),
    ),
    values: {
      present: values !== undefined,
      type: typeof values,
      keys: values === undefined ? [] : Object.keys(values).toSorted(),
      identities:
        values === undefined
          ? []
          : Object.keys(values)
              .toSorted()
              .map((key) => ({
                key,
                matchingConstants: constants
                  .filter(([, constant]) => values[key] === constant)
                  .map(([constantName]) => constantName),
              })),
    },
  };
}

function auditDetectorEnumPair(configuration, allNamespaces) {
  const { constants, createDetector, getter, label, namespace, setter } = configuration;
  const captureState = (detector) =>
    captureEnumCall(() => detector[getter](), namespace, constants);
  const defaultDetector = createDetector();
  const firstDefault = defaultDetector[getter]();
  const secondDefault = defaultDetector[getter]();
  const defaults = {
    first: describeEnumValue(firstDefault, namespace, constants),
    second: describeEnumValue(secondDefault, namespace, constants),
    repeatedIdentity: firstDefault === secondDefault,
  };
  safeDelete(defaultDetector);

  const defaultConstant = constants[0][1];
  const auditGetterArity = (...arguments_) => {
    const detector = createDetector();
    const stateBefore = captureState(detector);
    const call = captureEnumCall(() => detector[getter](...arguments_), namespace, constants);
    const stateAfter = captureState(detector);
    safeDelete(detector);
    return { stateBefore, call, stateAfter };
  };
  const auditSetterArity = (...arguments_) => {
    const detector = createDetector();
    const stateBefore = captureState(detector);
    const call = captureCall(() => detector[setter](...arguments_));
    const stateAfter = captureState(detector);
    safeDelete(detector);
    return { stateBefore, call, stateAfter };
  };
  const lengthDetector = createDetector();
  const arity = {
    getterLength: lengthDetector[getter].length,
    getterExact: auditGetterArity(),
    getterExtraOne: auditGetterArity(1),
    getterExtraTwo: auditGetterArity(1, 2),
    setterLength: lengthDetector[setter].length,
    setterMissing: auditSetterArity(),
    setterExact: auditSetterArity(defaultConstant),
    setterExtraOne: auditSetterArity(defaultConstant, 1),
    setterExtraTwo: auditSetterArity(defaultConstant, 1, 2),
  };
  safeDelete(lengthDetector);

  const foreignConstants = allNamespaces.map(({ constants: values, name }) => ({
    create: () => values[0][1],
    label: `foreign ${name}.${values[0][0]}`,
  }));
  const inputCases = [
    ...constants.map(([name, value]) => ({ create: () => value, label: `canonical ${name}` })),
    ...foreignConstants,
    { create: () => ({ value: constants[0][1].value }), label: "plain valid value" },
    { create: () => ({ value: -1 }), label: "plain negative one" },
    { create: () => ({ value: 1.9 }), label: "plain fraction" },
    { create: () => ({ value: Number.NaN }), label: "plain NaN" },
    { create: () => ({ value: Number.POSITIVE_INFINITY }), label: "plain infinity" },
    { create: () => ({ value: 4_294_967_296 }), label: "plain u32 modulus" },
    { create: () => ({ value: "2" }), label: "plain numeric string value" },
    { create: () => ({ value: "opencv" }), label: "plain nonnumeric string value" },
    { create: () => ({ value: true }), label: "plain boolean value" },
    { create: () => ({ value: null }), label: "plain null value" },
    { create: () => ({ value: undefined }), label: "plain undefined value" },
    { create: () => Object.create({ value: 1 }), label: "inherited value" },
    {
      create: () => Object.assign(Object.create(null), { value: 1 }),
      label: "null prototype value",
    },
    { create: () => ({}), label: "empty object" },
    { create: () => 2, label: "number primitive" },
    { create: () => "2", label: "string primitive" },
    { create: () => true, label: "boolean primitive" },
    { create: () => null, label: "null primitive" },
    { create: () => undefined, label: "undefined primitive" },
    {
      create: () => {
        let reads = 0;
        return {
          get reads() {
            return reads;
          },
          get value() {
            reads += 1;
            throw new Error("enum value getter sentinel");
          },
        };
      },
      label: "throwing value getter",
    },
  ];

  const setterInputs = inputCases.map(({ create, label: inputLabel }) => {
    const detector = createDetector();
    const input = create();
    const inputSummary = {
      type: typeof input,
      isNull: input === null,
      ownNames:
        (typeof input === "object" && input !== null) || typeof input === "function"
          ? Object.getOwnPropertyNames(input).toSorted()
          : [],
      value:
        (typeof input === "object" && input !== null) || typeof input === "function"
          ? capturePrimitive(() => input.value)
          : undefined,
      matches: allNamespaces.flatMap(({ constants: values, name }) =>
        values
          .filter(([, constant]) => constant === input)
          .map(([constantName]) => `${name}.${constantName}`),
      ),
      readsBefore:
        typeof input === "object" && input !== null && "reads" in input
          ? capturePrimitive(() => input.reads)
          : undefined,
    };
    const call = captureCall(() => detector[setter](input));
    const state = captureState(detector);
    const readsAfter =
      typeof input === "object" && input !== null && "reads" in input
        ? capturePrimitive(() => input.reads)
        : undefined;
    safeDelete(detector);
    return { label: inputLabel, input: inputSummary, call, state, readsAfter };
  });

  const deadDetector = createDetector();
  const firstDelete = captureCall(() => deadDetector.delete());
  const lifetime = {
    firstDelete,
    getterAfterDelete: captureEnumCall(() => deadDetector[getter](), namespace, constants),
    setterAfterDelete: captureCall(() => deadDetector[setter](defaultConstant)),
    secondDelete: captureCall(() => deadDetector.delete()),
  };

  return { label, defaults, arity, setterInputs, lifetime };
}

function auditDetectorEnums(reference) {
  const namespaces = [
    {
      name: "AKAZE_DescriptorType",
      namespace: reference.AKAZE_DescriptorType,
      names: [
        "DESCRIPTOR_KAZE_UPRIGHT",
        "DESCRIPTOR_KAZE",
        "DESCRIPTOR_MLDB_UPRIGHT",
        "DESCRIPTOR_MLDB",
      ],
    },
    {
      name: "KAZE_DiffusivityType",
      namespace: reference.KAZE_DiffusivityType,
      names: ["DIFF_PM_G1", "DIFF_PM_G2", "DIFF_WEICKERT", "DIFF_CHARBONNIER"],
    },
    {
      name: "AgastFeatureDetector_DetectorType",
      namespace: reference.AgastFeatureDetector_DetectorType,
      names: ["AGAST_5_8", "AGAST_7_12d", "AGAST_7_12s", "OAST_9_16"],
    },
    {
      name: "FastFeatureDetector_DetectorType",
      namespace: reference.FastFeatureDetector_DetectorType,
      names: ["TYPE_5_8", "TYPE_7_12", "TYPE_9_16"],
    },
  ].map((entry) => ({
    constants: entry.names.map((name) => [name, entry.namespace[name]]),
    name: entry.name,
    names: entry.names,
    namespace: entry.namespace,
  }));
  const byName = Object.fromEntries(namespaces.map((entry) => [entry.name, entry]));
  const configurations = [
    [
      "AKAZE descriptor type",
      () => new reference.AKAZE(),
      "getDescriptorType",
      "setDescriptorType",
      "AKAZE_DescriptorType",
    ],
    [
      "AKAZE diffusivity",
      () => new reference.AKAZE(),
      "getDiffusivity",
      "setDiffusivity",
      "KAZE_DiffusivityType",
    ],
    [
      "KAZE diffusivity",
      () => new reference.KAZE(),
      "getDiffusivity",
      "setDiffusivity",
      "KAZE_DiffusivityType",
    ],
    [
      "AGAST detector type",
      () => new reference.AgastFeatureDetector(),
      "getType",
      "setType",
      "AgastFeatureDetector_DetectorType",
    ],
    [
      "FAST detector type",
      () => new reference.FastFeatureDetector(),
      "getType",
      "setType",
      "FastFeatureDetector_DetectorType",
    ],
  ];
  const pairs = configurations.map(([label, createDetector, getter, setter, namespaceName]) => {
    const entry = byName[namespaceName];
    return auditDetectorEnumPair(
      {
        label,
        createDetector,
        getter,
        setter,
        namespace: entry.namespace,
        constants: entry.constants,
      },
      namespaces,
    );
  });
  const akaze = new reference.AKAZE();
  const kaze = new reference.KAZE();
  const crossIdentity = {
    akazeKazeDiffusivityDefaultSame: akaze.getDiffusivity() === kaze.getDiffusivity(),
    zeroConstantsAcrossNamespaces: namespaces.map((left) =>
      namespaces.map((right) => left.constants[0][1] === right.constants[0][1]),
    ),
  };
  akaze.delete();
  kaze.delete();
  return {
    namespaces: Object.fromEntries(
      namespaces.map(({ name, namespace, names }) => [
        name,
        summarizeEnumNamespace(name, namespace, names),
      ]),
    ),
    pairs,
    crossIdentity,
  };
}

function auditOptimalDftSize(owner) {
  const i32Cases = [
    ["positive fraction", 1.9],
    ["negative fraction", -1.9],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["i32 maximum", 2_147_483_647],
    ["i32 maximum plus one", 2_147_483_648],
    ["i32 minimum", -2_147_483_648],
    ["i32 minimum minus one", -2_147_483_649],
    ["u32 maximum", 4_294_967_295],
    ["u32 modulus", 4_294_967_296],
    ["null", null],
    ["true", true],
    ["false", false],
    ["numeric string", "42"],
    ["fraction string", "-1.9"],
    ["empty string", ""],
    ["non-numeric string", "opencv"],
    ["explicit undefined", undefined],
  ];
  const boundaryCases = [
    ["negative 1024", -1024],
    ["negative two", -2],
    ["negative one", -1],
    ["zero", 0],
    ["one", 1],
    ["two", 2],
    ["three", 3],
    ["seven", 7],
    ["twenty five", 25],
    ["last rounded input", 2_125_763_999],
    ["first sentinel input", 2_125_764_000],
    ["sentinel plus one", 2_125_764_001],
    ["i32 maximum minus one", 2_147_483_646],
  ];
  const auditCases = (cases) =>
    cases.map(([label, value]) => ({
      label,
      input: encodeValue(value),
      call: captureCall(() => owner.getOptimalDFTSize(value)),
    }));

  return {
    length: owner.getOptimalDFTSize.length,
    arity: {
      missing: captureCall(() => owner.getOptimalDFTSize()),
      exact: captureCall(() => owner.getOptimalDFTSize(7)),
      extraOne: captureCall(() => owner.getOptimalDFTSize(7, 1)),
      extraTwo: captureCall(() => owner.getOptimalDFTSize(7, 1, 2)),
    },
    i32: auditCases(i32Cases),
    boundaries: auditCases(boundaryCases),
  };
}

function safeDelete(detector) {
  try {
    detector.delete();
  } catch {
    // The audit records delete failures at their call site.
  }
}

function auditSetterCases(createDetector, setter, getter, cases) {
  return cases.map(([label, value]) => {
    const detector = createDetector();
    const call = captureCall(() => detector[setter](value));
    const state = captureCall(() => detector[getter]());
    safeDelete(detector);
    return { label, input: encodeValue(value), call, state };
  });
}

function auditGftt(createDetector) {
  const getters = [
    "getBlockSize",
    "getDefaultName",
    "getHarrisDetector",
    "getK",
    "getMaxFeatures",
    "getMinDistance",
    "getQualityLevel",
  ];
  const setters = [
    ["setBlockSize", "getBlockSize", 7],
    ["setHarrisDetector", "getHarrisDetector", true],
    ["setK", "getK", 0.5],
    ["setMaxFeatures", "getMaxFeatures", 77],
    ["setMinDistance", "getMinDistance", 2.5],
    ["setQualityLevel", "getQualityLevel", 0.5],
  ];
  const i32Cases = [
    ["positive fraction", 1.9],
    ["negative fraction", -1.9],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["i32 maximum", 2_147_483_647],
    ["i32 maximum plus one", 2_147_483_648],
    ["i32 minimum", -2_147_483_648],
    ["i32 minimum minus one", -2_147_483_649],
    ["u32 maximum", 4_294_967_295],
    ["u32 modulus", 4_294_967_296],
    ["null", null],
    ["true", true],
    ["false", false],
    ["numeric string", "42"],
    ["fraction string", "-1.9"],
    ["empty string", ""],
    ["non-numeric string", "opencv"],
    ["explicit undefined", undefined],
  ];
  const f64Cases = [
    ["negative zero", -0],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["null", null],
    ["true", true],
    ["false", false],
    ["numeric string", "1.25"],
    ["empty string", ""],
    ["non-numeric string", "opencv"],
    ["explicit undefined", undefined],
  ];
  const booleanCases = [
    ["true", true],
    ["false", false],
    ["zero", 0],
    ["one", 1],
    ["negative one", -1],
    ["two", 2],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["null", null],
    ["empty string", ""],
    ["zero string", "0"],
    ["false string", "false"],
    ["non-empty string", "opencv"],
    ["object", {}],
    ["explicit undefined", undefined],
  ];

  const arityDetector = createDetector();
  const arity = {
    getters: getters.map((method) => ({
      method,
      length: arityDetector[method].length,
      exact: captureCall(() => arityDetector[method]()),
      extraOne: captureCall(() => arityDetector[method](1)),
      extraTwo: captureCall(() => arityDetector[method](1, 2)),
    })),
    setters: setters.map(([method, getter, value]) => ({
      method,
      length: arityDetector[method].length,
      missing: captureCall(() => arityDetector[method]()),
      exact: captureCall(() => arityDetector[method](value)),
      stateAfterExact: captureCall(() => arityDetector[getter]()),
      extraOne: captureCall(() => arityDetector[method](value, 1)),
      extraTwo: captureCall(() => arityDetector[method](value, 1, 2)),
    })),
  };
  safeDelete(arityDetector);

  const deadDetector = createDetector();
  const firstDelete = captureCall(() => deadDetector.delete());
  const postDelete = {
    getters: getters.map((method) => ({
      method,
      call: captureCall(() => deadDetector[method]()),
    })),
    setters: setters.map(([method, , value]) => ({
      method,
      call: captureCall(() => deadDetector[method](value)),
    })),
    secondDelete: captureCall(() => deadDetector.delete()),
  };

  const deleteExtraOneDetector = createDetector();
  const deleteExtraOne = captureCall(() => deleteExtraOneDetector.delete(1));
  safeDelete(deleteExtraOneDetector);
  const deleteExtraTwoDetector = createDetector();
  const deleteExtraTwo = captureCall(() => deleteExtraTwoDetector.delete(1, 2));
  safeDelete(deleteExtraTwoDetector);
  const deleteLengthDetector = createDetector();
  const deleteLength = deleteLengthDetector.delete.length;
  safeDelete(deleteLengthDetector);

  return {
    arity,
    i32: {
      blockSize: auditSetterCases(createDetector, "setBlockSize", "getBlockSize", i32Cases),
      maxFeatures: auditSetterCases(createDetector, "setMaxFeatures", "getMaxFeatures", i32Cases),
    },
    f64: {
      k: auditSetterCases(createDetector, "setK", "getK", f64Cases),
      minDistance: auditSetterCases(createDetector, "setMinDistance", "getMinDistance", f64Cases),
      qualityLevel: auditSetterCases(
        createDetector,
        "setQualityLevel",
        "getQualityLevel",
        f64Cases,
      ),
    },
    boolean: auditSetterCases(
      createDetector,
      "setHarrisDetector",
      "getHarrisDetector",
      booleanCases,
    ),
    lifetime: {
      deleteLength,
      firstDelete,
      postDelete,
      deleteExtraOne,
      deleteExtraTwo,
    },
  };
}

function auditAkazePrimitive(createDetector) {
  const getters = [
    "getDefaultName",
    "getDescriptorChannels",
    "getDescriptorSize",
    "getNOctaveLayers",
    "getNOctaves",
    "getThreshold",
  ];
  const setters = [
    ["setDescriptorChannels", 2],
    ["setDescriptorSize", 96],
    ["setNOctaveLayers", 6],
    ["setNOctaves", 5],
    ["setThreshold", 0.25],
  ];
  const i32Cases = [
    ["positive fraction", 1.9],
    ["negative fraction", -1.9],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["i32 maximum", 2_147_483_647],
    ["i32 maximum plus one", 2_147_483_648],
    ["i32 minimum", -2_147_483_648],
    ["i32 minimum minus one", -2_147_483_649],
    ["u32 maximum", 4_294_967_295],
    ["u32 modulus", 4_294_967_296],
    ["null", null],
    ["true", true],
    ["false", false],
    ["numeric string", "42"],
    ["fraction string", "-1.9"],
    ["empty string", ""],
    ["non-numeric string", "opencv"],
    ["explicit undefined", undefined],
  ];
  const f64Cases = [
    ["negative zero", -0],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["null", null],
    ["true", true],
    ["false", false],
    ["numeric string", "1.25"],
    ["empty string", ""],
    ["non-numeric string", "opencv"],
    ["explicit undefined", undefined],
  ];

  const captureState = (detector) =>
    Object.fromEntries(getters.map((method) => [method, captureCall(() => detector[method]())]));
  const defaultsDetector = createDetector();
  const defaults = captureState(defaultsDetector);
  safeDelete(defaultsDetector);

  const getterArity = getters.map((method) => {
    const detector = createDetector();
    const audit = {
      method,
      length: detector[method].length,
      exact: captureCall(() => detector[method]()),
      extraOne: {
        stateBefore: captureState(detector),
        call: captureCall(() => detector[method](1)),
        stateAfter: captureState(detector),
      },
      extraTwo: {
        stateBefore: captureState(detector),
        call: captureCall(() => detector[method](1, 2)),
        stateAfter: captureState(detector),
      },
    };
    safeDelete(detector);
    return audit;
  });
  const setterArity = setters.map(([method, value]) => {
    const lengthDetector = createDetector();
    const length = lengthDetector[method].length;
    safeDelete(lengthDetector);
    const exactDetector = createDetector();
    const stateBeforeExact = captureState(exactDetector);
    const exact = captureCall(() => exactDetector[method](value));
    const stateAfterExact = captureState(exactDetector);
    safeDelete(exactDetector);

    const auditFailure = (invoke) => {
      const detector = createDetector();
      const stateBefore = captureState(detector);
      const call = captureCall(() => invoke(detector, method, value));
      const stateAfter = captureState(detector);
      safeDelete(detector);
      return { stateBefore, call, stateAfter };
    };

    return {
      method,
      length,
      exact: { stateBefore: stateBeforeExact, call: exact, stateAfter: stateAfterExact },
      missing: auditFailure((detector, setter) => detector[setter]()),
      extraOne: auditFailure((detector, setter, argument) => detector[setter](argument, 1)),
      extraTwo: auditFailure((detector, setter, argument) => detector[setter](argument, 1, 2)),
    };
  });

  const auditCases = (setter, cases) =>
    cases.map(([label, value]) => {
      const detector = createDetector();
      const stateBefore = captureState(detector);
      const call = captureCall(() => detector[setter](value));
      const stateAfter = captureState(detector);
      safeDelete(detector);
      return { label, input: encodeValue(value), stateBefore, call, stateAfter };
    });

  const deadDetector = createDetector();
  const deleteLength = captureCall(() => deadDetector.delete.length);
  const stateBeforeDelete = captureState(deadDetector);
  const firstDelete = captureCall(() => deadDetector.delete());
  const postDelete = {
    getters: getters.map((method) => ({
      method,
      call: captureCall(() => deadDetector[method]()),
    })),
    setters: setters.map(([method, value]) => ({
      method,
      call: captureCall(() => deadDetector[method](value)),
    })),
    secondDelete: captureCall(() => deadDetector.delete()),
  };

  const auditDeleteExtra = (...arguments_) => {
    const detector = createDetector();
    const stateBefore = captureState(detector);
    const call = captureCall(() => detector.delete(...arguments_));
    const stateAfter = captureState(detector);
    safeDelete(detector);
    return { stateBefore, call, stateAfter };
  };

  return {
    defaults,
    arity: { getters: getterArity, setters: setterArity },
    i32: {
      descriptorChannels: auditCases("setDescriptorChannels", i32Cases),
      descriptorSize: auditCases("setDescriptorSize", i32Cases),
      octaveLayers: auditCases("setNOctaveLayers", i32Cases),
      octaves: auditCases("setNOctaves", i32Cases),
    },
    f64: { threshold: auditCases("setThreshold", f64Cases) },
    lifetime: {
      deleteLength,
      stateBeforeDelete,
      firstDelete,
      postDelete,
      deleteExtraOne: auditDeleteExtra(1),
      deleteExtraTwo: auditDeleteExtra(1, 2),
    },
  };
}

function auditKazePrimitive(createDetector) {
  const getters = [
    "getDefaultName",
    "getExtended",
    "getNOctaveLayers",
    "getNOctaves",
    "getThreshold",
    "getUpright",
  ];
  const setters = [
    ["setExtended", true],
    ["setNOctaveLayers", 6],
    ["setNOctaves", 5],
    ["setThreshold", 0.25],
    ["setUpright", true],
  ];
  const i32Cases = [
    ["positive fraction", 1.9],
    ["negative fraction", -1.9],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["i32 maximum", 2_147_483_647],
    ["i32 maximum plus one", 2_147_483_648],
    ["i32 minimum", -2_147_483_648],
    ["i32 minimum minus one", -2_147_483_649],
    ["u32 maximum", 4_294_967_295],
    ["u32 modulus", 4_294_967_296],
    ["null", null],
    ["true", true],
    ["false", false],
    ["numeric string", "42"],
    ["fraction string", "-1.9"],
    ["empty string", ""],
    ["non-numeric string", "opencv"],
    ["explicit undefined", undefined],
  ];
  const f64Cases = [
    ["negative zero", -0],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["null", null],
    ["true", true],
    ["false", false],
    ["numeric string", "1.25"],
    ["empty string", ""],
    ["non-numeric string", "opencv"],
    ["explicit undefined", undefined],
  ];
  const booleanCases = [
    ["true", true],
    ["false", false],
    ["zero", 0],
    ["one", 1],
    ["negative one", -1],
    ["two", 2],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["null", null],
    ["empty string", ""],
    ["zero string", "0"],
    ["false string", "false"],
    ["non-empty string", "opencv"],
    ["object", {}],
    ["explicit undefined", undefined],
  ];

  const captureState = (detector) =>
    Object.fromEntries(getters.map((method) => [method, captureCall(() => detector[method]())]));
  const defaultsDetector = createDetector();
  const defaults = captureState(defaultsDetector);
  safeDelete(defaultsDetector);

  const getterArity = getters.map((method) => {
    const detector = createDetector();
    const audit = {
      method,
      length: detector[method].length,
      exact: captureCall(() => detector[method]()),
      extraOne: {
        stateBefore: captureState(detector),
        call: captureCall(() => detector[method](1)),
        stateAfter: captureState(detector),
      },
      extraTwo: {
        stateBefore: captureState(detector),
        call: captureCall(() => detector[method](1, 2)),
        stateAfter: captureState(detector),
      },
    };
    safeDelete(detector);
    return audit;
  });
  const setterArity = setters.map(([method, value]) => {
    const lengthDetector = createDetector();
    const length = lengthDetector[method].length;
    safeDelete(lengthDetector);
    const exactDetector = createDetector();
    const stateBeforeExact = captureState(exactDetector);
    const exact = captureCall(() => exactDetector[method](value));
    const stateAfterExact = captureState(exactDetector);
    safeDelete(exactDetector);

    const auditFailure = (invoke) => {
      const detector = createDetector();
      const stateBefore = captureState(detector);
      const call = captureCall(() => invoke(detector, method, value));
      const stateAfter = captureState(detector);
      safeDelete(detector);
      return { stateBefore, call, stateAfter };
    };

    return {
      method,
      length,
      exact: { stateBefore: stateBeforeExact, call: exact, stateAfter: stateAfterExact },
      missing: auditFailure((detector, setter) => detector[setter]()),
      extraOne: auditFailure((detector, setter, argument) => detector[setter](argument, 1)),
      extraTwo: auditFailure((detector, setter, argument) => detector[setter](argument, 1, 2)),
    };
  });

  const auditCases = (setter, cases) =>
    cases.map(([label, value]) => {
      const detector = createDetector();
      const stateBefore = captureState(detector);
      const call = captureCall(() => detector[setter](value));
      const stateAfter = captureState(detector);
      safeDelete(detector);
      return { label, input: encodeValue(value), stateBefore, call, stateAfter };
    });

  const deadDetector = createDetector();
  const deleteLength = captureCall(() => deadDetector.delete.length);
  const stateBeforeDelete = captureState(deadDetector);
  const firstDelete = captureCall(() => deadDetector.delete());
  const postDelete = {
    getters: getters.map((method) => ({
      method,
      call: captureCall(() => deadDetector[method]()),
    })),
    setters: setters.map(([method, value]) => ({
      method,
      call: captureCall(() => deadDetector[method](value)),
    })),
    secondDelete: captureCall(() => deadDetector.delete()),
  };

  const auditDeleteExtra = (...arguments_) => {
    const detector = createDetector();
    const stateBefore = captureState(detector);
    const call = captureCall(() => detector.delete(...arguments_));
    const stateAfter = captureState(detector);
    safeDelete(detector);
    return { stateBefore, call, stateAfter };
  };

  return {
    defaults,
    arity: { getters: getterArity, setters: setterArity },
    boolean: {
      extended: auditCases("setExtended", booleanCases),
      upright: auditCases("setUpright", booleanCases),
    },
    i32: {
      octaveLayers: auditCases("setNOctaveLayers", i32Cases),
      octaves: auditCases("setNOctaves", i32Cases),
    },
    f64: { threshold: auditCases("setThreshold", f64Cases) },
    lifetime: {
      deleteLength,
      stateBeforeDelete,
      firstDelete,
      postDelete,
      deleteExtraOne: auditDeleteExtra(1),
      deleteExtraTwo: auditDeleteExtra(1, 2),
    },
  };
}

function auditThresholdDetector(createDetector) {
  const getters = ["getDefaultName", "getNonmaxSuppression", "getThreshold"];
  const setters = [
    ["setNonmaxSuppression", "getNonmaxSuppression", false],
    ["setThreshold", "getThreshold", 37],
  ];
  const i32Cases = [
    ["positive fraction", 1.9],
    ["negative fraction", -1.9],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["i32 maximum", 2_147_483_647],
    ["i32 maximum plus one", 2_147_483_648],
    ["i32 minimum", -2_147_483_648],
    ["i32 minimum minus one", -2_147_483_649],
    ["u32 maximum", 4_294_967_295],
    ["u32 modulus", 4_294_967_296],
    ["null", null],
    ["true", true],
    ["false", false],
    ["numeric string", "42"],
    ["fraction string", "-1.9"],
    ["empty string", ""],
    ["non-numeric string", "opencv"],
    ["explicit undefined", undefined],
  ];
  const booleanCases = [
    ["true", true],
    ["false", false],
    ["zero", 0],
    ["one", 1],
    ["negative one", -1],
    ["two", 2],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["null", null],
    ["empty string", ""],
    ["zero string", "0"],
    ["false string", "false"],
    ["non-empty string", "opencv"],
    ["object", {}],
    ["explicit undefined", undefined],
  ];

  const defaultsDetector = createDetector();
  const defaults = Object.fromEntries(
    getters.map((method) => [method, captureCall(() => defaultsDetector[method]())]),
  );
  safeDelete(defaultsDetector);

  const getterArity = getters.map((method) => {
    const detector = createDetector();
    const audit = {
      method,
      length: detector[method].length,
      exact: captureCall(() => detector[method]()),
      extraOne: captureCall(() => detector[method](1)),
      stateAfterExtraOne: captureCall(() => detector[method]()),
      extraTwo: captureCall(() => detector[method](1, 2)),
      stateAfterExtraTwo: captureCall(() => detector[method]()),
    };
    safeDelete(detector);
    return audit;
  });
  const setterArity = setters.map(([method, getter, value]) => {
    const lengthDetector = createDetector();
    const length = lengthDetector[method].length;
    safeDelete(lengthDetector);
    const exactDetector = createDetector();
    const exact = captureCall(() => exactDetector[method](value));
    const stateAfterExact = captureCall(() => exactDetector[getter]());
    safeDelete(exactDetector);

    const auditFailure = (invoke) => {
      const detector = createDetector();
      const stateBefore = captureCall(() => detector[getter]());
      const call = captureCall(() => invoke(detector, method, value));
      const stateAfter = captureCall(() => detector[getter]());
      safeDelete(detector);
      return { stateBefore, call, stateAfter };
    };

    return {
      method,
      length,
      exact,
      stateAfterExact,
      missing: auditFailure((detector, setter) => detector[setter]()),
      extraOne: auditFailure((detector, setter, argument) => detector[setter](argument, 1)),
      extraTwo: auditFailure((detector, setter, argument) => detector[setter](argument, 1, 2)),
    };
  });

  const deadDetector = createDetector();
  const firstDelete = captureCall(() => deadDetector.delete());
  const postDelete = {
    getters: getters.map((method) => ({
      method,
      call: captureCall(() => deadDetector[method]()),
    })),
    setters: setters.map(([method, , value]) => ({
      method,
      call: captureCall(() => deadDetector[method](value)),
    })),
    secondDelete: captureCall(() => deadDetector.delete()),
  };

  const auditDeleteExtra = (...arguments_) => {
    const detector = createDetector();
    const stateBefore = captureCall(() => detector.getThreshold());
    const call = captureCall(() => detector.delete(...arguments_));
    const stateAfter = captureCall(() => detector.getThreshold());
    safeDelete(detector);
    return { stateBefore, call, stateAfter };
  };
  const deleteLengthDetector = createDetector();
  const deleteLength = captureCall(() => deleteLengthDetector.delete.length);
  safeDelete(deleteLengthDetector);

  return {
    defaults,
    arity: { getters: getterArity, setters: setterArity },
    i32: auditSetterCases(createDetector, "setThreshold", "getThreshold", i32Cases),
    boolean: auditSetterCases(
      createDetector,
      "setNonmaxSuppression",
      "getNonmaxSuppression",
      booleanCases,
    ),
    lifetime: {
      deleteLength,
      firstDelete,
      postDelete,
      deleteExtraOne: auditDeleteExtra(1),
      deleteExtraTwo: auditDeleteExtra(1, 2),
    },
  };
}

async function loadOpenCv() {
  try {
    importScripts("/test/browser/.cache/opencv-4.13.0.js");
  } catch {
    importScripts("https://docs.opencv.org/4.13.0/opencv.js");
  }
  self.postMessage({
    progress: "OpenCV.js script loaded; initializing WASM...",
  });
  if (cv.then !== undefined) {
    return new Promise((resolve) => {
      cv.then((ready) => {
        delete ready.then;
        resolve(ready);
      });
    });
  }
  if (cv.Mat !== undefined) {
    return cv;
  }
  return new Promise((resolve) => {
    const checkReady = () => {
      if (cv.Mat !== undefined) {
        resolve(cv);
        return;
      }
      setTimeout(checkReady, 10);
    };
    checkReady();
  });
}

self.addEventListener("message", async ({ data: input }) => {
  try {
    const reference = await loadOpenCv();
    self.postMessage({ progress: "OpenCV.js WASM initialized; comparing outputs..." });
    const request = input?.referenceRequest;
    const sourceInput = request === undefined ? input : input.input;
    if (request === "transpose") {
      self.postMessage({ outputs: { transposeAudit: auditTranspose(reference) } });
      return;
    }
    if (request === "flip") {
      self.postMessage({ outputs: { flipAudit: auditFlip(reference) } });
      return;
    }
    if (request === "repeat") {
      self.postMessage({ outputs: { repeatAudit: auditRepeat(reference) } });
      return;
    }
    if (request === "rotate") {
      self.postMessage({ outputs: { rotateAudit: auditRotate(reference) } });
      return;
    }
    if (request === "count-non-zero") {
      self.postMessage({ outputs: { countNonZeroAudit: auditCountNonZero(reference) } });
      return;
    }
    if (request === "float-math") {
      self.postMessage({ outputs: { floatMathAudit: auditFloatMath(reference) } });
      return;
    }
    if (request === "coordinate-conversions") {
      self.postMessage({
        outputs: { coordinateAudit: auditCoordinateConversions(reference) },
      });
      return;
    }
    const source = reference.matFromArray(2, 3, reference.CV_8UC1, sourceInput);
    const outputs = {};
    const operations = [
      ["flip", (target) => reference.flip(source, target, 1)],
      ["transpose", (target) => reference.transpose(source, target)],
      ["rotate", (target) => reference.rotate(source, target, reference.ROTATE_90_CLOCKWISE)],
      ["repeat", (target) => reference.repeat(source, 2, 1, target)],
    ];
    for (const [name, operation] of operations) {
      const target = new reference.Mat();
      operation(target);
      outputs[name] = copyBytes(target);
      target.delete();
    }
    source.delete();

    const contour = reference.matFromArray(
      4,
      1,
      reference.CV_32SC2,
      new Int32Array([0, 0, 4, 0, 4, 3, 0, 3]),
    );
    const bounds = reference.boundingRect(contour);
    outputs.arcLength = reference.arcLength(contour, true);
    outputs.contourArea = reference.contourArea(contour, false);
    outputs.boundingRect = [bounds.x, bounds.y, bounds.width, bounds.height];
    outputs.isContourConvex = reference.isContourConvex(contour);
    outputs.pointPolygonTest = reference.pointPolygonTest(contour, new reference.Point(2, 1), true);
    contour.delete();

    const kernel = reference.getStructuringElement(
      reference.MORPH_CROSS,
      new reference.Size(3, 3),
      new reference.Point(1, 1),
    );
    outputs.getStructuringElement = copyBytes(kernel);
    kernel.delete();

    const rotation = reference.getRotationMatrix2D(new reference.Point(1, 2), 90, 1);
    outputs.getRotationMatrix2D = copyF64(rotation);
    rotation.delete();

    outputs.optimalDftSizes = [
      reference.getOptimalDFTSize(7),
      reference.getOptimalDFTSize(25),
      reference.getOptimalDFTSize(0),
      reference.getOptimalDFTSize(-1),
      reference.getOptimalDFTSize(2_125_763_999),
      reference.getOptimalDFTSize(2_125_764_000),
    ];
    outputs.optimalDftSizeAudit = auditOptimalDftSize(reference);

    const akaze = new reference.AKAZE();
    outputs.akazeDefaultName = akaze.getDefaultName();
    outputs.akazeDefaults = [
      akaze.getDescriptorType().value,
      akaze.getDescriptorSize(),
      akaze.getDescriptorChannels(),
      akaze.getThreshold(),
      akaze.getNOctaves(),
      akaze.getNOctaveLayers(),
      akaze.getDiffusivity().value,
    ];
    akaze.setDescriptorType(reference.AKAZE_DescriptorType.DESCRIPTOR_MLDB_UPRIGHT);
    akaze.setDescriptorSize(96);
    akaze.setDescriptorChannels(2);
    akaze.setThreshold(0.05);
    akaze.setNOctaves(5);
    akaze.setNOctaveLayers(6);
    akaze.setDiffusivity(reference.KAZE_DiffusivityType.DIFF_WEICKERT);
    outputs.akazeMutated = [
      akaze.getDescriptorType().value,
      akaze.getDescriptorSize(),
      akaze.getDescriptorChannels(),
      akaze.getThreshold(),
      akaze.getNOctaves(),
      akaze.getNOctaveLayers(),
      akaze.getDiffusivity().value,
    ];
    akaze.delete();
    const agast = new reference.AgastFeatureDetector();
    const fast = new reference.FastFeatureDetector();
    const agastType = agast.getType();
    const fastType = fast.getType();
    outputs.agastDefaultName = agast.getDefaultName();
    outputs.agastDefaults = [agast.getNonmaxSuppression(), agast.getThreshold(), agastType.value];
    agast.setNonmaxSuppression(false);
    agast.setThreshold(-1);
    agast.setType(reference.AgastFeatureDetector_DetectorType.AGAST_5_8);
    outputs.agastMutated = [
      agast.getNonmaxSuppression(),
      agast.getThreshold(),
      agast.getType().value,
    ];
    outputs.fastDefaultName = fast.getDefaultName();
    outputs.fastDefaults = [fast.getNonmaxSuppression(), fast.getThreshold(), fastType.value];
    fast.setNonmaxSuppression(false);
    fast.setThreshold(256);
    fast.setType(reference.FastFeatureDetector_DetectorType.TYPE_5_8);
    outputs.fastMutated = [fast.getNonmaxSuppression(), fast.getThreshold(), fast.getType().value];
    agast.delete();
    fast.delete();

    const kaze = new reference.KAZE();
    outputs.kazeDefaultName = kaze.getDefaultName();
    outputs.kazeDefaults = [
      kaze.getDiffusivity().value,
      kaze.getExtended(),
      kaze.getNOctaveLayers(),
      kaze.getNOctaves(),
      kaze.getThreshold(),
      kaze.getUpright(),
    ];
    kaze.setDiffusivity(reference.KAZE_DiffusivityType.DIFF_WEICKERT);
    kaze.setExtended(true);
    kaze.setNOctaveLayers(6);
    kaze.setNOctaves(5);
    kaze.setThreshold(-1);
    kaze.setUpright(true);
    outputs.kazeMutated = [
      kaze.getDiffusivity().value,
      kaze.getExtended(),
      kaze.getNOctaveLayers(),
      kaze.getNOctaves(),
      kaze.getThreshold(),
      kaze.getUpright(),
    ];
    kaze.delete();
    const gftt = new reference.GFTTDetector();
    outputs.gfttDefaultName = gftt.getDefaultName();
    outputs.gfttDefaults = [
      gftt.getBlockSize(),
      gftt.getHarrisDetector(),
      gftt.getK(),
      gftt.getMaxFeatures(),
      gftt.getMinDistance(),
      gftt.getQualityLevel(),
    ];
    gftt.setBlockSize(-1);
    gftt.setHarrisDetector(true);
    gftt.setK(-1);
    gftt.setMaxFeatures(-1);
    gftt.setMinDistance(-1);
    gftt.setQualityLevel(-1);
    outputs.gfttMutated = [
      gftt.getBlockSize(),
      gftt.getHarrisDetector(),
      gftt.getK(),
      gftt.getMaxFeatures(),
      gftt.getMinDistance(),
      gftt.getQualityLevel(),
    ];
    gftt.setK(Number.NaN);
    gftt.setMinDistance(Number.NEGATIVE_INFINITY);
    gftt.setQualityLevel(Number.POSITIVE_INFINITY);
    outputs.gfttNonFinite = [
      Number.isNaN(gftt.getK()),
      gftt.getMinDistance() === Number.NEGATIVE_INFINITY,
      gftt.getQualityLevel() === Number.POSITIVE_INFINITY,
    ];
    gftt.delete();

    outputs.gfttAudit = auditGftt(() => new reference.GFTTDetector());
    outputs.akazePrimitiveAudit = auditAkazePrimitive(() => new reference.AKAZE());
    outputs.detectorEnumAudit = auditDetectorEnums(reference);
    outputs.kazePrimitiveAudit = auditKazePrimitive(() => new reference.KAZE());
    outputs.agastPrimitiveAudit = auditThresholdDetector(
      () => new reference.AgastFeatureDetector(),
    );
    outputs.fastPrimitiveAudit = auditThresholdDetector(() => new reference.FastFeatureDetector());
    outputs.flipAudit = auditFlip(reference);
    outputs.repeatAudit = auditRepeat(reference);
    outputs.rotateAudit = auditRotate(reference);
    outputs.transposeAudit = auditTranspose(reference);
    outputs.countNonZeroAudit = auditCountNonZero(reference);
    outputs.floatMathAudit = auditFloatMath(reference);
    outputs.coordinateAudit = auditCoordinateConversions(reference);
    self.postMessage({ outputs });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
});
