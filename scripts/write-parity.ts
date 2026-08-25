import { format } from "prettier";

import { PARITY_MANIFEST } from "../parity/manifest.js";

const serialized = await format(JSON.stringify(PARITY_MANIFEST), {
  parser: "json",
  printWidth: 100,
});
await Bun.write("docs/parity.json", serialized);
process.stdout.write("Wrote docs/parity.json\n");
