async function runCheck(label: string, command: string[]): Promise<void> {
  process.stdout.write(`\nRunning ${label}\n`);
  const child = Bun.spawn(command, {
    stderr: "inherit",
    stdout: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`${label} check failed with exit code ${exitCode}`);
  }
}

await runCheck("format", ["bun", "run", "fmt:check"]);
await runCheck("lint", ["bun", "run", "lint"]);
await runCheck("types", ["bun", "run", "typecheck"]);
await runCheck("TypeScript tests", ["bun", "run", "test"]);
await runCheck("Rust tests", ["bun", "run", "test:rust"]);
await runCheck("parity", ["bun", "run", "parity:check"]);
await runCheck("documentation", ["bun", "run", "docs:check"]);
await runCheck("version", ["bun", "run", "version:check"]);
