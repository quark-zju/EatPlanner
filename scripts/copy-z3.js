import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "public");
mkdirSync(root, { recursive: true });

const files = [
  "node_modules/z3-solver/build/z3-built.js",
  "node_modules/z3-solver/build/z3-built.wasm",
];

for (const file of files) {
  const src = resolve(import.meta.dirname, "..", file);
  const dest = resolve(root, file.split("/").pop());
  copyFileSync(src, dest);
}

console.log("Copied z3-built assets to public/.");
