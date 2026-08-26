import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const source = "https://docs.opencv.org/4.13.0/opencv.js";
const expectedSha256 = "63366510248adf3a7eddf3e793dd825404efb7df3749f4d6f8557c7fa4ca8aa0";
const target = join(import.meta.dir, "..", "test", "browser", ".cache", "opencv-4.13.0.js");

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readValidCache(): Promise<boolean> {
  const cached = Bun.file(target);
  if (!(await cached.exists())) {
    return false;
  }
  return (await sha256(await cached.arrayBuffer())) === expectedSha256;
}

if (await readValidCache()) {
  process.stdout.write(`OpenCV.js 4.13.0 comparator cache is valid: ${target}\n`);
  process.exit(0);
}

const response = await fetch(source);
if (!response.ok) {
  throw new Error(`Could not download OpenCV.js comparator: HTTP ${response.status}`);
}
const bytes = await response.arrayBuffer();
const actualSha256 = await sha256(bytes);
if (actualSha256 !== expectedSha256) {
  throw new Error(
    `OpenCV.js comparator checksum mismatch: expected ${expectedSha256}, received ${actualSha256}`,
  );
}

await mkdir(dirname(target), { recursive: true });
await Bun.write(target, bytes);
process.stdout.write(`Cached verified OpenCV.js 4.13.0 comparator: ${target}\n`);
