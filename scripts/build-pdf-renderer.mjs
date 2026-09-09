/**
 * Prebuilds the PDF renderer into a self-contained ESM module that Next does
 * NOT compile.
 *
 * Why: Next compiles server files with its own bundled React, while
 * @react-pdf/renderer (kept external) uses the workspace React. Those two React
 * copies tag elements with different internal symbols, so passing a JSX tree
 * created by Next's React into @react-pdf's reconciler throws React error #31
 * ("Objects are not valid as a React child").
 *
 * By bundling quote-document.tsx here with esbuild (node_modules external), the
 * element creation AND the reconciler both resolve the SAME workspace React at
 * runtime, so the symbols match. The Next route loads this prebuilt file with a
 * webpackIgnore dynamic import and only ever passes it plain snapshot data.
 */
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const outdir = join(process.cwd(), "lib", "pdf", "generated");
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: [join(process.cwd(), "lib", "pdf", "quote-document.tsx")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  // Keep every dependency external so Node resolves a single React instance
  // (and react-pdf's wildcard package exports) natively at runtime.
  packages: "external",
  jsx: "automatic",
  outfile: join(outdir, "quote-renderer.mjs"),
});

console.log("Built lib/pdf/generated/quote-renderer.mjs");
