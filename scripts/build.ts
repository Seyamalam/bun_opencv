import { rm } from "node:fs/promises";

await rm("dist", { force: true, recursive: true });
await rm("wasm", { force: true, recursive: true });

async function runBuild(label: string, command: string[]): Promise<void> {
  process.stdout.write(`Building ${label}\n`);
  const child = Bun.spawn(command, {
    stderr: "inherit",
    stdout: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`${label} build failed with exit code ${exitCode}`);
  }
}

await runBuild("WebAssembly", ["bun", "run", "build:wasm"]);
await rm("wasm/.gitignore", { force: true });
await runBuild("TypeScript", ["bun", "run", "build:ts"]);
await runBuild("WASM smoke test", ["bun", "run", "test:wasm"]);
