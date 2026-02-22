import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "public");
mkdirSync(root, { recursive: true });

const src = resolve(
  import.meta.dirname,
  "..",
  "node_modules",
  "coi-serviceworker",
  "coi-serviceworker.min.js"
);
const dest = resolve(root, "coi-serviceworker.min.js");
copyFileSync(src, dest);

console.log("Copied coi-serviceworker.min.js to public/.");
