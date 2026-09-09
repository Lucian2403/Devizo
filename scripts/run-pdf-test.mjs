/**
 * Runner for the PDF tests. @react-pdf/renderer uses wildcard package exports
 * (e.g. "@react-pdf/hyphenate/en-us") that tsx's path resolver cannot expand,
 * so we bundle the test with esbuild (keeping node_modules external, which lets
 * Node resolve those wildcard exports natively) and then run it.
 *
 * Next.js (webpack) resolves the same imports fine at runtime; this shim only
 * exists so the test can run outside the Next build.
 */
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const outfile = join(process.cwd(), ".tmp", "test-pdf.mjs");
mkdirSync(join(process.cwd(), ".tmp"), { recursive: true });

await build({
  entryPoints: ["scripts/test-pdf.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  jsx: "automatic",
  outfile,
});

await import(pathToFileURL(outfile).href);
