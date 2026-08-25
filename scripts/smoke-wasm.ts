import { grayscaleRgba, initSync, matFromU8 } from "#wasm";

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

process.stdout.write("WASM smoke test passed\n");
