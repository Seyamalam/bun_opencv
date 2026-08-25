import { PARITY_MANIFEST } from "../parity/manifest.js";

const packageSource = await Bun.file("package.json").text();
const cargoSource = await Bun.file("Cargo.toml").text();
const changelogSource = await Bun.file("CHANGELOG.md").text();

function capture(source: string, pattern: RegExp, label: string): string {
  const value = pattern.exec(source)?.[1];
  if (value === undefined) {
    throw new Error(`Could not read ${label}`);
  }
  return value;
}

const packageVersion = capture(packageSource, /"version":\s*"([^"]+)"/u, "package.json version");
const cargoVersion = capture(
  cargoSource,
  /\[workspace\.package\][\s\S]*?version\s*=\s*"([^"]+)"/u,
  "Cargo workspace version",
);

if (packageVersion !== cargoVersion) {
  throw new Error(`package.json ${packageVersion} does not match Cargo.toml ${cargoVersion}`);
}
if (packageVersion !== PARITY_MANIFEST.packageVersion) {
  throw new Error(`package.json ${packageVersion} does not match the parity manifest`);
}
if (!changelogSource.includes(`## [${packageVersion}]`)) {
  throw new Error(`CHANGELOG.md has no ${packageVersion} release heading`);
}

process.stdout.write(`Version ${packageVersion} is consistent\n`);
