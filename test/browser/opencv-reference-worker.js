/* global importScripts, cv */
/* oxlint-disable unicorn/require-post-message-target-origin */

function copyBytes(matrix) {
  return new Uint8Array(matrix.data);
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
    self.postMessage({ outputs });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
});
