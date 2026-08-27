import clearance from "../docs/release-clearance.json" with { type: "json" };

const reviews = [
  ["package name trademark review", clearance.packageNameReviewed],
  ["source-independent implementation confirmation", clearance.noOpenCvMaterialCopied],
] as const;

const blockedReviews = reviews.filter((review) => !review[1]).map((review) => review[0]);

if (blockedReviews.length > 0) {
  const details = blockedReviews.map((review) => `unresolved: ${review}`);
  throw new Error(`Release clearance failed\n${details.join("\n")}`);
}

process.stdout.write("Release clearance passed\n");
