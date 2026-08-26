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
        "compatible-same-parent-overlap-both",
        [0, 0, 3, 3],
        [1, 1, 3, 3],
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
    outputs.transposeAudit = auditTranspose(reference);
    self.postMessage({ outputs });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
});
