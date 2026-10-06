import assert from "node:assert/strict";
import { formatSourceImpact } from "../domain/professional-estimates/normative-intelligence.service";
import { normalizeOfficialSourceContent } from "../infrastructure/normative/http-source-monitor";

const pageA = [
  "<html><body>",
  "<header>navigation v1</header>",
  "<main><h1>CP L.01.01-2012</h1><p>Statutul În vigoare</p></main>",
  "<form>newsletter</form>",
  "<footer>Număr total de accesări 100</footer>",
  "</body></html>",
].join("");

const pageB = [
  "<html><body>",
  "<header>navigation v2</header>",
  "<main><h1>CP L.01.01-2012</h1><p>Statutul În vigoare</p></main>",
  "<form>different newsletter</form>",
  "<footer>Număr total de accesări 999</footer>",
  "</body></html>",
].join("");

const pageChanged = [
  "<html><body>",
  "<header>navigation v2</header>",
  "<main><h1>CP L.01.01-2012</h1><p>Statutul Înlocuit</p></main>",
  "<footer>Număr total de accesări 1000</footer>",
  "</body></html>",
].join("");

assert.equal(
  normalizeOfficialSourceContent(pageA),
  normalizeOfficialSourceContent(pageB),
  "non-document chrome must not trigger a normative change",
);
assert.notEqual(
  normalizeOfficialSourceContent(pageA),
  normalizeOfficialSourceContent(pageChanged),
  "document content changes must remain detectable",
);

assert.equal(
  formatSourceImpact({
    normVersions: 0,
    resources: 0,
    resourcePrices: 0,
    calculationRules: 0,
  }),
  "Sursa nu este încă folosită în calcule profesionale.",
);

const impact = formatSourceImpact({
  normVersions: 2,
  resources: 4,
  resourcePrices: 3,
  calculationRules: 1,
});
assert.match(impact, /2 versiuni de norme/);
assert.match(impact, /4 resurse/);
assert.match(impact, /3 prețuri de resurse/);
assert.match(impact, /1 regulă de calcul/);

console.log("Normative intelligence checks passed.");
