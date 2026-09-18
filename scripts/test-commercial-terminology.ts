import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { PDF_STRINGS } from "../lib/pdf/quote-strings";

const sourceRoots = ["app", join("lib", "pdf")];
const sourceExtensions = new Set([".ts", ".tsx"]);
const professionalEstimateWord = /\bdeviz(?:e|ul|ului|ele|elor)?\b/giu;
const violations: string[] = [];

function scan(directory: string) {
  for (const name of readdirSync(directory)) {
    const fullPath = join(directory, name);
    if (statSync(fullPath).isDirectory()) {
      scan(fullPath);
      continue;
    }
    if (!sourceExtensions.has(extname(fullPath))) continue;

    const lines = readFileSync(fullPath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      professionalEstimateWord.lastIndex = 0;
      if (professionalEstimateWord.test(line)) {
        violations.push(
          `${relative(process.cwd(), fullPath)}:${index + 1}: ${line.trim()}`,
        );
      }
    });
  }
}

sourceRoots.forEach(scan);

assert.deepEqual(
  violations,
  [],
  `Commercial UI still uses professional estimate terminology:\n${violations.join("\n")}`,
);

assert.equal(PDF_STRINGS.ro.documentTitle, "Ofertă comercială");
assert.equal(PDF_STRINGS.ru.documentTitle, "Коммерческое предложение");
assert.equal(PDF_STRINGS.en.documentTitle, "Quote");

console.log("Commercial terminology boundary is clean.");
