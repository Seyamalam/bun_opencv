/* global importScripts, cv */
/* oxlint-disable unicorn/require-post-message-target-origin */

function copyBytes(matrix) {
  return new Uint8Array(matrix.data);
}

function copyF64(matrix) {
  return Array.from(matrix.data64F);
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
    self.postMessage({ outputs });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
});
