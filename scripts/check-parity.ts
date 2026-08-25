import { format } from "prettier";

import { PARITY_MANIFEST } from "../parity/manifest.js";
import type { ParityEntry } from "../parity/manifest.js";
import { OPENCV_OPERATIONS } from "../src/operations.js";

const rustSource = await Bun.file("crates/opencv-wasm/src/lib.rs").text();
const parityDocument = await Bun.file("docs/PARITY.md").text();
const readme = await Bun.file("README.md").text();
const generatedManifest = await Bun.file("docs/parity.json").text();
const expectedManifest = await format(JSON.stringify(PARITY_MANIFEST), {
  parser: "json",
  printWidth: 100,
});

if (generatedManifest !== expectedManifest) {
  throw new Error("docs/parity.json is stale; run `bun run parity:write`");
}

const implemented = PARITY_MANIFEST.entries.filter((entry) => entry.status === "implemented");
const manifestMethods = new Set(implemented.map((entry) => entry.method));
const sourceMethods = new Set(OPENCV_OPERATIONS.map((operation) => operation.method));

if (manifestMethods.size !== sourceMethods.size) {
  throw new Error("implemented parity entries do not match the TypeScript operation count");
}

for (const operation of OPENCV_OPERATIONS) {
  if (!manifestMethods.has(operation.method)) {
    throw new Error(`TypeScript operation ${operation.method} is missing from the parity manifest`);
  }
  if (!rustSource.includes(`js_name = ${operation.wasmExport}`)) {
    throw new Error(`Rust export ${operation.wasmExport} is missing`);
  }
  if (!parityDocument.includes(`\`${operation.method}\``)) {
    throw new Error(`docs/PARITY.md does not mention ${operation.method}`);
  }
  if (!readme.includes(`\`${operation.method}\``)) {
    throw new Error(`README.md parity table does not mention ${operation.method}`);
  }
}

function validateImplementedProvenance(entry: ParityEntry): void {
  if (entry.implementationOrigin !== "original") {
    throw new Error(`Implemented entry ${entry.method} has no original-authorship record`);
  }
  if (entry.sources.length === 0) {
    throw new Error(`Implemented entry ${entry.method} has no specification source`);
  }
}

for (const entry of implemented) {
  validateImplementedProvenance(entry);
  if (!sourceMethods.has(entry.method)) {
    throw new Error(`Parity entry ${entry.method} is not exported by TypeScript`);
  }
  if (entry.wasmExport === undefined || !rustSource.includes(`js_name = ${entry.wasmExport}`)) {
    throw new Error(`Parity entry ${entry.method} has no matching Rust export`);
  }
}

for (const entry of PARITY_MANIFEST.entries) {
  if (!readme.includes(`\`${entry.method}\``)) {
    throw new Error(`README.md parity table does not mention tracked entry ${entry.method}`);
  }
}

process.stdout.write(`Parity check passed for ${implemented.length} implemented operations\n`);
