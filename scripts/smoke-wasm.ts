import { grayscaleRgba, initSync, matFlip, matFromI16, matFromU8, matSum } from "#wasm";

const bytes = await Bun.file("wasm/bun_opencv_wasm_bg.wasm").arrayBuffer();
initSync({ module: bytes });

const output = grayscaleRgba(new Uint8Array([255, 0, 0, 17]), 1, 1);
const expected = new Uint8Array([77, 77, 77, 17]);

if (!output.every((value, index) => value === expected[index])) {
  throw new Error(`WASM smoke test returned ${output.join(",")}; expected ${expected.join(",")}`);
}

const matrix = matFromU8(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 2, 4, 1);
const region = matrix.roi(0, 1, 2, 2);
const regionBytes = region.toUint8Array();
const expectedRegion = new Uint8Array([2, 3, 6, 7]);
if (!regionBytes.every((value, index) => value === expectedRegion[index])) {
  throw new Error(
    `WASM matrix region returned ${regionBytes.join(",")}; expected ${expectedRegion.join(",")}`,
  );
}
matrix.free();
region.free();

const signed = matFromI16(new Int16Array([-2, 7, 30_000, -5]), 2, 2, 1);
const signedTotal = matSum(signed);
if (signedTotal.length !== 4 || signedTotal[0] !== 30_000) {
  throw new Error(`WASM signed reduction returned ${signedTotal.join(",")}; expected 30000,0,0,0`);
}
const flipped = matFlip(signed, 1);
const flippedValues = flipped.toInt16Array();
const expectedFlipped = new Int16Array([7, -2, -5, 30_000]);
if (!flippedValues.every((value, index) => value === expectedFlipped[index])) {
  throw new Error(
    `WASM signed flip returned ${flippedValues.join(",")}; expected ${expectedFlipped.join(",")}`,
  );
}
flipped.free();
signed.free();

process.stdout.write("WASM smoke test passed\n");
