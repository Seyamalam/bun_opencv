import { dirname, resolve } from "node:path";

const requiredDocuments = [
  "README.md",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "ROADMAP.md",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.md",
  "TODO.md",
  "docs/API.md",
  "docs/ARCHITECTURE.md",
  "docs/COMPATIBILITY_POLICY.md",
  "docs/LICENSING_RESEARCH.md",
  "docs/PARITY.md",
  "docs/PERFORMANCE.md",
  "docs/PUBLISHING.md",
  "docs/VERSIONING.md",
] as const;

async function checkDocument(document: string): Promise<void> {
  if (!(await Bun.file(document).exists())) {
    throw new Error(`Required document ${document} is missing`);
  }

  const contents = await Bun.file(document).text();
  const linkedFiles: string[] = [];
  for (const match of contents.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)) {
    const target = match[1];
    if (
      target === undefined ||
      target.startsWith("#") ||
      target.startsWith("http://") ||
      target.startsWith("https://") ||
      target.startsWith("mailto:")
    ) {
      continue;
    }

    const relativeTarget = target.split("#", 1)[0];
    if (relativeTarget === undefined || relativeTarget.length === 0) {
      continue;
    }
    linkedFiles.push(relativeTarget);
  }

  await Promise.all(
    linkedFiles.map(async (relativeTarget) => {
      const path = resolve(dirname(document), relativeTarget);
      if (await Bun.file(path).exists()) {
        return;
      }
      throw new Error(`${document} links to missing file ${relativeTarget}`);
    }),
  );
}

await Promise.all(requiredDocuments.map(checkDocument));

process.stdout.write(`Documentation check passed for ${requiredDocuments.length} files\n`);
