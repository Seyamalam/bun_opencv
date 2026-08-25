import { format } from "prettier";

import { PARITY_MANIFEST } from "../parity/manifest.js";
import type { ParityEntry } from "../parity/manifest.js";
import {
  UPSTREAM_BROWSER_INVENTORY,
  UPSTREAM_COUNTS_BY_MODULE,
  UPSTREAM_OPERATION_FAMILY_COUNT,
} from "../parity/upstream-inventory.js";
import { OPENCV_OPERATIONS } from "../src/operations.js";

const PARITY_TARGET_RATIO = 0.25;
const EXPECTED_OPERATION_FAMILY_COUNT = 488;
const EXPECTED_PARITY_TARGET = 122;

const rustFilePaths = Array.from(
  new Bun.Glob("crates/opencv-wasm/src/**/*.rs").scanSync({ cwd: "." }),
);
if (rustFilePaths.length === 0) {
  throw new Error("No Rust source files found for parity export validation");
}

const rustSources = await Promise.all(rustFilePaths.map(async (path) => Bun.file(path).text()));
const rustSource = rustSources.join("\n");
const parityDocument = await Bun.file("docs/PARITY.md").text();
const inventoryDocument = await Bun.file("docs/INVENTORY.md").text();
const readme = await Bun.file("README.md").text();
const generatedManifest = await Bun.file("docs/parity.json").text();
const expectedManifest = await format(JSON.stringify(PARITY_MANIFEST), {
  parser: "json",
  printWidth: 100,
});

if (generatedManifest !== expectedManifest) {
  throw new Error("docs/parity.json is stale; run `bun run parity:write`");
}

const inventoryCountFromModules = Object.values(UPSTREAM_COUNTS_BY_MODULE).reduce(
  (total, count) => total + count,
  0,
);
if (
  UPSTREAM_BROWSER_INVENTORY.length !== UPSTREAM_OPERATION_FAMILY_COUNT ||
  inventoryCountFromModules !== UPSTREAM_OPERATION_FAMILY_COUNT
) {
  throw new Error("Upstream inventory totals disagree");
}
if (UPSTREAM_OPERATION_FAMILY_COUNT !== EXPECTED_OPERATION_FAMILY_COUNT) {
  throw new Error(
    `Pinned parity denominator changed from ${EXPECTED_OPERATION_FAMILY_COUNT} to ${UPSTREAM_OPERATION_FAMILY_COUNT}; review the baseline before accepting it`,
  );
}

const parityTarget = Math.ceil(UPSTREAM_OPERATION_FAMILY_COUNT * PARITY_TARGET_RATIO);
if (parityTarget !== EXPECTED_PARITY_TARGET) {
  throw new Error(
    `The 25% parity target changed from ${EXPECTED_PARITY_TARGET} to ${parityTarget}`,
  );
}

const inventoryById = new Map(UPSTREAM_BROWSER_INVENTORY.map((family) => [family.id, family]));
if (inventoryById.size !== UPSTREAM_OPERATION_FAMILY_COUNT) {
  throw new Error("Upstream inventory contains duplicate family IDs");
}

const manifestEntries: readonly ParityEntry[] = PARITY_MANIFEST.entries;
const manifestUpstreamIds = new Set<string>();
const manifestMethods = new Set<string>();
for (const entry of manifestEntries) {
  if (manifestUpstreamIds.has(entry.upstreamId)) {
    throw new Error(`Duplicate parity upstreamId ${entry.upstreamId}`);
  }
  manifestUpstreamIds.add(entry.upstreamId);

  if (manifestMethods.has(entry.method)) {
    throw new Error(`Duplicate parity method ${entry.method}`);
  }
  manifestMethods.add(entry.method);

  const upstreamFamily = inventoryById.get(entry.upstreamId);
  if (upstreamFamily === undefined) {
    throw new Error(
      `Parity entry ${entry.method} references unknown upstreamId ${entry.upstreamId}`,
    );
  }
  if (upstreamFamily.module !== entry.module) {
    throw new Error(
      `Parity entry ${entry.method} records module ${entry.module}, but ${entry.upstreamId} belongs to ${upstreamFamily.module}`,
    );
  }
}

const supported = manifestEntries.filter((entry) => entry.status !== "planned");
const implemented = manifestEntries.filter((entry) => entry.status === "implemented");
const supportedByMethod = new Map(supported.map((entry) => [entry.method, entry]));
const sourceMethods = new Set<string>(OPENCV_OPERATIONS.map((operation) => operation.method));

if (supportedByMethod.size !== supported.length) {
  throw new Error("Supported parity entries contain duplicate TypeScript method names");
}
if (sourceMethods.size !== OPENCV_OPERATIONS.length) {
  throw new Error("src/operations.ts contains duplicate TypeScript method names");
}
if (supportedByMethod.size !== sourceMethods.size) {
  throw new Error(
    `Supported parity entries (${supportedByMethod.size}) do not match the TypeScript operation count (${sourceMethods.size})`,
  );
}

function hasRustExport(wasmExport: string): boolean {
  const escapedExport = wasmExport.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`js_name\\s*=\\s*${escapedExport}\\b`, "u").test(rustSource);
}

function validateSupportedProvenance(entry: ParityEntry): void {
  if (entry.implementationOrigin !== "original") {
    throw new Error(`Supported entry ${entry.method} has no original-authorship record`);
  }
  if (entry.sources.length === 0) {
    throw new Error(`Supported entry ${entry.method} has no specification source`);
  }
}

for (const operation of OPENCV_OPERATIONS) {
  const entry = supportedByMethod.get(operation.method);
  if (entry === undefined) {
    throw new Error(
      `TypeScript operation ${operation.method} is missing from supported parity entries`,
    );
  }
  validateSupportedProvenance(entry);

  if (entry.wasmExport !== operation.wasmExport) {
    throw new Error(
      `TypeScript operation ${operation.method} expects Rust export ${operation.wasmExport}, but the manifest records ${entry.wasmExport ?? "none"}`,
    );
  }
  if (!hasRustExport(operation.wasmExport)) {
    throw new Error(
      `Rust export ${operation.wasmExport} is missing from ${rustFilePaths.length} scanned source files`,
    );
  }
  if (!parityDocument.includes(`\`${operation.method}\``)) {
    throw new Error(`docs/PARITY.md does not mention supported method ${operation.method}`);
  }
  if (!readme.includes(`\`${operation.method}\``)) {
    throw new Error(`README.md parity table does not mention supported method ${operation.method}`);
  }
}

for (const entry of supported) {
  validateSupportedProvenance(entry);
  if (!sourceMethods.has(entry.method)) {
    throw new Error(`Supported parity entry ${entry.method} is not exported by TypeScript`);
  }
  if (entry.wasmExport === undefined || !hasRustExport(entry.wasmExport)) {
    throw new Error(`Supported parity entry ${entry.method} has no matching Rust export`);
  }
}

for (const entry of manifestEntries) {
  if (!readme.includes(`\`${entry.method}\``)) {
    throw new Error(`README.md parity table does not mention tracked entry ${entry.method}`);
  }
}

for (const [documentName, contents] of [
  ["README.md", readme],
  ["docs/PARITY.md", parityDocument],
  ["docs/INVENTORY.md", inventoryDocument],
] as const) {
  if (!contents.includes(String(UPSTREAM_OPERATION_FAMILY_COUNT))) {
    throw new Error(
      `${documentName} does not mention the ${UPSTREAM_OPERATION_FAMILY_COUNT}-family denominator`,
    );
  }
  if (!contents.includes(String(parityTarget))) {
    throw new Error(`${documentName} does not mention the 25% target of ${parityTarget} families`);
  }
}

if (!readme.includes("docs/INVENTORY.md")) {
  throw new Error("README.md does not link to docs/INVENTORY.md");
}
if (!parityDocument.includes("INVENTORY.md")) {
  throw new Error("docs/PARITY.md does not link to docs/INVENTORY.md");
}

const implementedPercent = (implemented.length / UPSTREAM_OPERATION_FAMILY_COUNT) * 100;
process.stdout.write(
  `Parity check passed: ${implemented.length}/${UPSTREAM_OPERATION_FAMILY_COUNT} fully implemented (${implementedPercent.toFixed(2)}%); 25% target ${parityTarget}; ${supported.length} supported including partial\n`,
);
