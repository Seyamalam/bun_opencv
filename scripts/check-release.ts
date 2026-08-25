import clearance from "../docs/release-clearance.json" with { type: "json" };
import { PARITY_MANIFEST } from "../parity/manifest.js";
import type { ParityEntry } from "../parity/manifest.js";

const reviews = [
  ["package name trademark review", clearance.packageNameReviewed],
  ["legal review", clearance.legalReviewCompleted],
  ["shipped-operation patent review", clearance.implementedOperationsPatentReviewed],
  ["source-independent implementation confirmation", clearance.noOpenCvMaterialCopied],
] as const;

const blockedReviews = reviews.filter((review) => !review[1]).map((review) => review[0]);

function requiresPatentReview(entry: ParityEntry): boolean {
  return entry.status !== "planned" && entry.patentReview !== "reviewed";
}

const blockedOperations = PARITY_MANIFEST.entries
  .filter(requiresPatentReview)
  .map((entry) => entry.method);

if (blockedReviews.length > 0 || blockedOperations.length > 0) {
  const details = [
    ...blockedReviews.map((review) => `unresolved: ${review}`),
    ...blockedOperations.map((operation) => `patent review required: ${operation}`),
  ];
  throw new Error(`Release clearance failed\n${details.join("\n")}`);
}

process.stdout.write("Release clearance passed\n");
