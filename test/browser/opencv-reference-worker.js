/* global importScripts, cv */
/* oxlint-disable unicorn/require-post-message-target-origin, anti-slop/no-runtime-typeof */

function copyBytes(matrix) {
  return new Uint8Array(matrix.data);
}

function copyF64(matrix) {
  return Array.from(matrix.data64F);
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
    const source = reference.matFromArray(2, 3, reference.CV_8UC1, input);
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
    outputs.agastPrimitiveAudit = auditThresholdDetector(
      () => new reference.AgastFeatureDetector(),
    );
    outputs.fastPrimitiveAudit = auditThresholdDetector(() => new reference.FastFeatureDetector());
    self.postMessage({ outputs });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
});
