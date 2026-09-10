/**
 * Lightweight tests for the AI matching + extraction schema. No test framework
 * is installed, so this runs as a plain script via tsx and exits non-zero on
 * failure. Run with:  npx --yes pnpm@9.12.0 test:ai
 */

import assert from "node:assert/strict";
import { classify, scoreTokens, buildQueryTokens } from "../domain/ai/matching";
import {
  tagText,
  hasStrongConflict,
  expandJargon,
  tagProfileRoles,
  hasProfileRoleConflict,
  parseThicknessMm,
  hasThicknessConflict,
  parseMountType,
  hasMountTypeConflict,
  parseElectricalIntent,
  hasElectricalIntentConflict,
} from "../domain/ai/concepts";
import { jobExtractionSchema } from "../schemas/domain/aiExtraction";
import {
  rectangleArea,
  roomWallArea,
  computeSurfaceArea,
} from "../domain/quotes/geometry";
import { buildEmbedText, embedTextHash } from "../domain/ai/catalogEmbedding";
import { EstimateAssistantService } from "../domain/ai/estimate.service";
import type { CatalogItem, CatalogItemRepository } from "../domain/catalog/item.repository";
import type { EmbeddingProvider } from "../domain/ai/embedding.provider";
import type { ExtractionProvider } from "../domain/ai/providers";
import type {
  ExtractedItem,
  MatchCandidate,
  MatchedItem,
  MissingInformationField,
} from "../domain/ai/extraction.types";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function candidate(
  id: string,
  score: number,
  overrides: Partial<MatchCandidate> = {},
): MatchCandidate {
  return {
    catalogItemId: id,
    name: id,
    code: null,
    unit: "m2",
    sellingPrice: "10.00",
    score,
    ...overrides,
  };
}

console.log("AI matching:");

test("diacritics-insensitive token scoring", () => {
  // "faianta" (query) should still match "faianță" (catalog) strongly.
  const score = scoreTokens(["faianta", "montaj"], "Montaj faianță pereți");
  assert.ok(score > 0.3, `expected a solid score, got ${score}`);
});

test("classify: single strong candidate is matched", () => {
  const r = classify([candidate("a", 0.8)]);
  assert.equal(r.status, "matched");
  assert.equal(r.suggestedCatalogItemId, "a");
});

test("classify: close scores need review (not preselected as matched)", () => {
  const r = classify([candidate("a", 0.7), candidate("b", 0.65)]);
  assert.equal(r.status, "review");
});

test("classify: weak top score is unmatched (prefer NO_MATCH)", () => {
  const r = classify([candidate("a", 0.2)]);
  assert.equal(r.status, "unmatched");
  assert.equal(r.suggestedCatalogItemId, null);
});

test("classify: no candidates is unmatched", () => {
  const r = classify([]);
  assert.equal(r.status, "unmatched");
});

test("buildQueryTokens blends concept, description and search terms", () => {
  const item = {
    concept: "REMOVE_FLOOR_TILES",
    normalizedConcept: "remove floor tiles",
    surface: "floor",
    description: "dat jos gresia",
    searchTerms: ["gresie", "demontare"],
  } as ExtractedItem;
  const tokens = buildQueryTokens(item);
  assert.ok(tokens.includes("gresie"));
  assert.ok(tokens.includes("demontare"));
});

console.log("Moldovan/Romanian/Russian terminology:");

test("tagText recognizes putty jargon (glet/șpacluire/шпаклевка)", () => {
  for (const t of ["glet pereti", "spacluire", "spacliovca", "шпаклевка"]) {
    assert.ok(tagText(t).objects.has("putty"), `expected putty for "${t}"`);
  }
});

test("tagText recognizes wallpaper (tapet/oboi/обои)", () => {
  for (const t of ["tapet vechi", "oboi", "обои"]) {
    assert.ok(tagText(t).objects.has("wallpaper"), `expected wallpaper for "${t}"`);
  }
});

test("tagText recognizes screed and sockets (стяжка, розетка)", () => {
  assert.ok(tagText("стяжка").objects.has("screed"));
  assert.ok(tagText("розетка").objects.has("socket"));
  assert.ok(tagText("montare priza").objects.has("socket"));
});

test("tagText recognizes remove action (снять плитку → remove + tiles)", () => {
  const tags = tagText("снять плитку");
  assert.ok(tags.actions.has("remove"));
  assert.ok(tags.objects.has("tiles"));
});

test("expandJargon bridges jargon to catalog words", () => {
  assert.deepEqual(expandJargon("spacliovca").sort(), ["glet", "spacluire"]);
  assert.deepEqual(expandJargon("oboi"), ["tapet"]);
  assert.deepEqual(expandJargon("стяжка"), ["sapa"]);
  assert.deepEqual(expandJargon("potoloc"), ["tavan"]);
});

console.log("Compatibility filtering:");

test("REMOVE+WALLPAPER must not match REMOVE+DRYWALL", () => {
  // "Demontare perete din gips-carton" → remove + drywall.
  const candidate = tagText("Demontare perete din gips-carton");
  assert.equal(hasStrongConflict("remove", "wallpaper", candidate), true);
});

test("PREPARE+PUTTY must not match mesh (fibră de sticlă)", () => {
  const candidate = tagText("Aplicare fibra de sticla pe pereti");
  assert.equal(hasStrongConflict("prepare", "putty", candidate), true);
});

test("PREPARE+PUTTY is compatible with a glet item", () => {
  const candidate = tagText("Glet pereti pentru vopsire");
  assert.equal(hasStrongConflict("prepare", "putty", candidate), false);
});

test("remove vs install is a strong action conflict", () => {
  const candidate = tagText("Montare faianta pana la 60 cm");
  assert.equal(hasStrongConflict("remove", "tiles", candidate), true);
});

test("'Demontare' is remove only, never install (montare substring trap)", () => {
  const tags = tagText("Demontare fereastra");
  assert.ok(tags.actions.has("remove"));
  assert.ok(!tags.actions.has("install"));
  // An install of sanitary ware must therefore exclude a remove-window row.
  assert.equal(hasStrongConflict("install", "sanitaryware", tags), true);
});

test("sanitary/pipe objects are tagged and compatible with their installs", () => {
  const lavoar = tagText("Montare lavoar");
  assert.ok(lavoar.objects.has("sanitaryware"));
  assert.ok(lavoar.actions.has("install"));
  assert.equal(hasStrongConflict("install", "sanitaryware", lavoar), false);
  const pipe = tagText("Pozare teava canalizare");
  assert.ok(pipe.objects.has("pipe"));
});

console.log("AI extraction schema:");

test("valid extraction parses; quantity stays a string", () => {
  const parsed = jobExtractionSchema.parse({
    detectedLanguage: "ro",
    items: [
      {
        concept: "REMOVE_FLOOR_TILES",
        kind: "labor",
        action: "remove",
        object: "tiles",
        surface: "floor",
        normalizedConcept: "remove floor tiles",
        rawText: "dat jos gresia",
        description: "Demontare gresie",
        quantity: "18",
        unit: "m2",
        confidence: 0.9,
        searchTerms: ["gresie"],
      },
    ],
    assumptions: [],
    missingInformation: [],
  });
  assert.equal(parsed.items[0]!.quantity, "18");
  assert.equal(typeof parsed.items[0]!.quantity, "string");
});

test("structured missingInformation parses without currentValue", () => {
  const parsed = jobExtractionSchema.parse({
    detectedLanguage: "ro",
    items: [
      {
        concept: "INSTALL_PIPES",
        kind: "labor",
        action: "install",
        object: "pipe",
        surface: null,
        normalizedConcept: "install pipes",
        rawText: "țevi noi",
        description: "Montaj țevi noi",
        quantity: null,
        unit: "m",
        confidence: 0.7,
        searchTerms: ["montaj tevi"],
      },
    ],
    assumptions: [],
    missingInformation: [
      {
        label: "Lungimea țevii de apă rece",
        question: "Introdu lungimea traseului de apă rece",
        relatedItemIndex: 0,
        target: { type: "item_quantity", key: null },
        inputType: "number",
        unit: "m",
        options: [],
        required: true,
      },
    ],
  });
  assert.equal(parsed.missingInformation.length, 1);
  assert.equal(parsed.missingInformation[0]!.target.type, "item_quantity");
});

test("invalid missing target key is rejected", () => {
  assert.throws(() =>
    jobExtractionSchema.parse({
      detectedLanguage: "ro",
      items: [],
      assumptions: [],
      missingInformation: [
        {
          label: "Dimensiune",
          question: "x",
          relatedItemIndex: null,
          target: { type: "geometry_dimension", key: "tile_size" },
          inputType: "number",
          unit: "m",
          options: [],
          required: true,
        },
      ],
    }),
  );
});

test("unsupported unit is rejected (no silent coercion)", () => {
  assert.throws(() =>
    jobExtractionSchema.parse({
      detectedLanguage: "ro",
      items: [
        {
          concept: "X",
          kind: "labor",
          action: "other",
          object: null,
          surface: null,
          normalizedConcept: "x",
          rawText: "x",
          description: "x",
          quantity: null,
          unit: "square_foot",
          confidence: 0.5,
          searchTerms: [],
        },
      ],
      assumptions: [],
      missingInformation: [],
    }),
  );
});

test("negative/zero quantity is rejected", () => {
  assert.throws(() =>
    jobExtractionSchema.parse({
      detectedLanguage: "en",
      items: [
        {
          concept: "X",
          kind: "labor",
          action: "other",
          object: null,
          surface: null,
          normalizedConcept: "x",
          rawText: "x",
          description: "x",
          quantity: "0",
          unit: "pcs",
          confidence: 0.5,
          searchTerms: [],
        },
      ],
      assumptions: [],
      missingInformation: [],
    }),
  );
});

console.log("Geometry (deterministic take-off):");

test("C: single drywall wall 4m x 2.7m = 10.8 m2", () => {
  assert.equal(rectangleArea(4, 2.7), "10.8");
});

test("D: room 5x4x2.75 minus window 1.5x1.4 and door 0.8x2.0 = 45.8 m2", () => {
  const area = roomWallArea({
    length: 5,
    width: 4,
    height: 2.75,
    openings: [
      { width: 1.5, height: 1.4 },
      { width: 0.8, height: 2.0 },
    ],
  });
  assert.equal(area, "45.8");
});

console.log("Regression: real-world geometry + surface/object safety:");

// TEST 1 — room walls (net) and ceiling from raw dimensions.
test("T1: walls 5.2x3.8x2.72 minus window 1.6x1.4 and door 0.9x2.05 = 44.88 m2", () => {
  const area = computeSurfaceArea("room_walls", {
    length: 5.2,
    width: 3.8,
    height: 2.72,
    openings: [
      { width: 1.6, height: 1.4 },
      { width: 0.9, height: 2.05 },
    ],
  });
  assert.equal(area, "44.88");
});

test("T1: ceiling 5.2 x 3.8 = 19.76 m2", () => {
  assert.equal(computeSurfaceArea("ceiling", { length: 5.2, width: 3.8 }), "19.76");
});

test("T1: amorsare tavan (primer) must NOT match 'Glet tavan pentru vopsire' (putty)", () => {
  const row = tagText("Glet tavan pentru vopsire");
  // Item is priming on the ceiling; the row is ceiling putty → object conflict.
  assert.ok(hasStrongConflict("prepare", "primer", row, "ceiling"));
});

test("T6: 'pentru vopsire' is a purpose clause, not a paint operation", () => {
  const row = tagText("Glet tavan pentru vopsire");
  // Primary object is putty; the trailing "pentru vopsire" must NOT tag paint.
  assert.ok(row.objects.has("putty"));
  assert.ok(!row.objects.has("paint"));
  assert.ok(!row.actions.has("finish"));
  // A real paint row keeps paint tagged.
  const paintRow = tagText("Vopsire tavan un strat");
  assert.ok(paintRow.objects.has("paint"));
  assert.ok(paintRow.actions.has("finish"));
});

test("T6: ceiling paint item must NOT match the ceiling putty row", () => {
  const puttyRow = tagText("Glet tavan pentru vopsire");
  // Vopsirea tavanului → finish/paint on ceiling; putty row is now a conflict.
  assert.ok(hasStrongConflict("finish", "paint", puttyRow, "ceiling"));
  const paintRow = tagText("Vopsire tavan un strat");
  assert.ok(!hasStrongConflict("finish", "paint", paintRow, "ceiling"));
});

// TEST 2 — single drywall wall, net area, no truncation.
test("T2: drywall wall 4.30 x 2.65 minus door 0.8 x 2.0 = 9.8 m2 (net)", () => {
  const area = computeSurfaceArea("wall_rectangle", {
    width: 4.3,
    height: 2.65,
    openings: [{ width: 0.8, height: 2.0 }],
  });
  assert.equal(area, "9.8");
});

test("T2: gross drywall wall 4.30 x 2.65 rounds half-up to 11.4 (never 11.39)", () => {
  assert.equal(rectangleArea(4.3, 2.65), "11.4");
});

// TEST 3 — surface compatibility keeps floor tile vs wall tile separate.
test("T3: floor tile item must NOT match a wall-tile catalog row", () => {
  const wallTileRow = tagText("Montaj faianță pe pereți");
  assert.ok(hasStrongConflict("install", "tiles", wallTileRow, "floor"));
});

test("T3: wall tile item must NOT match a floor-tile catalog row", () => {
  const floorTileRow = tagText("Montaj gresie pardoseală");
  assert.ok(hasStrongConflict("install", "tiles", floorTileRow, "wall"));
});

test("T3: same-surface tile stays compatible (floor tile vs floor-tile row)", () => {
  const floorTileRow = tagText("Montaj gresie pardoseală");
  assert.ok(!hasStrongConflict("install", "tiles", floorTileRow, "floor"));
});

// TEST 4 — compound drywall scope decomposes into atomic requirements.
test("T4: compound drywall input decomposes into labor + explicit materials + specs", () => {
  const parsed = jobExtractionSchema.parse({
    detectedLanguage: "ro",
    items: [
      {
        concept: "constructie perete gips-carton",
        kind: "labor",
        action: "install",
        object: "drywall",
        surface: "wall",
        normalizedConcept: "install drywall partition",
        rawText: "Facem un perete de 4.30 lungime și 2.65 înălțime, gips-carton dublu pe ambele părți",
        description: "Perete gips-carton dublu pe ambele părți, profil 75",
        quantity: null,
        unit: "m2",
        confidence: 0.9,
        searchTerms: ["gips-carton", "perete despartitor"],
        specifications: ["gips-carton dublu", "pe ambele părți"],
        geometry: {
          shape: "wall_rectangle",
          length: null,
          width: 4.3,
          height: 2.65,
          openings: [{ width: 0.8, height: 2.0, count: 1 }],
        },
      },
      {
        concept: "vata minerala 75mm",
        kind: "material",
        action: "install",
        object: "other",
        surface: "wall",
        normalizedConcept: "mineral wool 75mm",
        rawText: "vată minerală de 75 înăuntru",
        description: "Vată minerală 75 mm",
        quantity: null,
        unit: "m2",
        confidence: 0.8,
        searchTerms: ["vata minerala"],
        specifications: ["75 mm"],
        geometry: null,
      },
      {
        concept: "profil 75",
        kind: "material",
        action: "install",
        object: "other",
        surface: null,
        normalizedConcept: "metal profile 75",
        rawText: "Profil normal de 75",
        description: "Profil 75 mm",
        quantity: null,
        unit: "m",
        confidence: 0.8,
        searchTerms: ["profil 75"],
        specifications: ["75 mm"],
        geometry: null,
      },
    ],
    assumptions: [],
    missingInformation: [],
    // Door install intent is unclear → informational legacy note.
    missingInformationText: ["Nu este clar dacă montajul ușii este inclus."],
  });
  // Labor + two explicit materials survive as separate structured items.
  assert.equal(parsed.items.length, 3);
  assert.equal(parsed.items[0]!.kind, "labor");
  assert.deepEqual(parsed.items[0]!.specifications, [
    "gips-carton dublu",
    "pe ambele părți",
  ]);
  assert.equal(parsed.items[1]!.kind, "material");
  assert.equal(parsed.items[2]!.kind, "material");
  // Materials without an explicit deterministic quantity stay null.
  assert.equal(parsed.items[1]!.quantity, null);
  assert.equal(parsed.items[2]!.quantity, null);
});

test("T4: specifications default to [] when the model omits them", () => {
  const parsed = jobExtractionSchema.parse({
    detectedLanguage: "ro",
    items: [
      {
        concept: "x",
        kind: "labor",
        action: "install",
        object: null,
        surface: null,
        normalizedConcept: "x",
        rawText: "x",
        description: "x",
        quantity: null,
        unit: "m2",
        confidence: 0.5,
        searchTerms: [],
      },
    ],
    assumptions: [],
    missingInformation: [],
  });
  assert.deepEqual(parsed.items[0]!.specifications, []);
});

// TEST 5 — drywall profile technical role (partition vs ceiling).
test("T5: 'profil normal de 75' is a partition stud, not a ceiling profile", () => {
  const roles = tagProfileRoles("Profil normal de 75");
  assert.ok(roles.has("partition_stud"));
  assert.ok(!roles.has("ceiling_profile"));
});

test("T5: CW/UW → partition; CD 60/27 / UD → ceiling", () => {
  assert.ok(tagProfileRoles("Profil CW 75").has("partition_stud"));
  assert.ok(tagProfileRoles("Profil UW 75").has("partition_track"));
  assert.ok(tagProfileRoles("Profil CD gips-carton 60/27 4 m").has("ceiling_profile"));
  assert.ok(tagProfileRoles("Profil UD 28/27").has("ceiling_track"));
});

test("T5: partition profile requirement must NOT match CD ceiling profile", () => {
  const required = tagProfileRoles("Profil normal de 75");
  const candidate = tagProfileRoles("Profil CD gips-carton 60/27 4 m");
  assert.ok(hasProfileRoleConflict(required, candidate));
});

test("T5: partition profile requirement stays compatible with CW 75", () => {
  const required = tagProfileRoles("Profil normal de 75");
  const candidate = tagProfileRoles("Profil CW 75 x 4 m");
  assert.ok(!hasProfileRoleConflict(required, candidate));
});

test("T5: non-profile rows are never tagged (no false conflict)", () => {
  // "Vată minerală 75 mm" also has 75, but it is not a profile.
  assert.equal(tagProfileRoles("Vată minerală 75 mm").size, 0);
  assert.ok(
    !hasProfileRoleConflict(
      tagProfileRoles("Profil normal de 75"),
      tagProfileRoles("Vată minerală 75 mm"),
    ),
  );
});

// TEST 7 — explicit material thickness must be respected (75 mm ≠ 50 mm).
test("T7: parseThicknessMm reads mm, cm and dimension triples", () => {
  assert.equal(parseThicknessMm("grosime 75 mm"), 75);
  assert.equal(parseThicknessMm("Vată minerală de 75 mm pentru izolație"), 75);
  // 100x60x5 cm → smallest dimension 5 cm = 50 mm thickness.
  assert.equal(parseThicknessMm("Vată minerală Rockmin 100x60x5 cm"), 50);
  assert.equal(parseThicknessMm("Vată minerală Akusto Plus 75 mm, 10,8 m²"), 75);
  assert.equal(parseThicknessMm("Fără dimensiuni"), null);
});

test("T7: 75 mm requirement conflicts with a 50 mm (100x60x5 cm) candidate", () => {
  const requiredMm = parseThicknessMm("grosime 75 mm");
  assert.ok(hasThicknessConflict(requiredMm, "Vată minerală Rockmin 100x60x5 cm"));
});

test("T7: 75 mm requirement stays compatible with a 75 mm candidate", () => {
  const requiredMm = parseThicknessMm("grosime 75 mm");
  assert.ok(
    !hasThicknessConflict(requiredMm, "Vată minerală Akusto Plus 75 mm, 10,8 m²"),
  );
});

test("T7: unknown thickness never blocks (no false conflict)", () => {
  assert.ok(!hasThicknessConflict(null, "Vată minerală Rockmin 100x60x5 cm"));
  assert.ok(!hasThicknessConflict(75, "Vată minerală fără dimensiune"));
});

// TEST 8 — bathroom: waterproofing object + WC mount type + water systems.
test("T8: waterproofing is its own object, never tiles nor mesh", () => {
  const wp = tagText("Aplicare hidroizolație pe podea");
  assert.ok(wp.objects.has("waterproofing"));
  assert.ok(!wp.objects.has("tiles"));
  // Waterproofing item must NOT match a tile-install row (object conflict).
  const tileRow = tagText("Montare gresie până la 60 cm");
  assert.ok(hasStrongConflict("install", "waterproofing", tileRow, "floor"));
  // Nor a fiberglass mesh reinforcement row.
  const meshRow = tagText("Aplicare fibră de sticlă pe pereți");
  assert.ok(hasStrongConflict("install", "waterproofing", meshRow, "wall"));
  // A real waterproofing row stays compatible.
  const wpRow = tagText("Hidroizolare baie sub placări");
  assert.ok(!hasStrongConflict("install", "waterproofing", wpRow, "floor"));
});

test("T8: WC suspendat/încastrat must block a floor-mounted WC row", () => {
  const required = parseMountType("Montare WC suspendat");
  assert.equal(required, "suspended");
  assert.ok(hasMountTypeConflict(required, "Montare vas WC pe pardoseală"));
  assert.ok(!hasMountTypeConflict(required, "Montare WC încastrat"));
  // Unknown mount on the candidate never conflicts.
  assert.ok(!hasMountTypeConflict(required, "Montare WC"));
});

// TEST 9 — electrical intent taxonomy (Golden Test 4).
test("T9: intent taxonomy classifies each electrical operation distinctly", () => {
  assert.equal(
    parseElectricalIntent("Montare puncte noi pentru prize, cu cablu și doză"),
    "new_point",
  );
  assert.equal(
    parseElectricalIntent("La două prize existente mutăm punctul cu 60 cm"),
    "relocate",
  );
  assert.equal(parseElectricalIntent("Montare 3 întrerupătoare de lumină"), "mechanism");
  assert.equal(parseElectricalIntent("punem un automat de 20A"), "circuit_breaker");
  assert.equal(
    parseElectricalIntent("tragem un circuit separat până în tablou"),
    "cable_route",
  );
  // Catalog rows tag the same way.
  assert.equal(parseElectricalIntent("Executare punct electric"), "new_point");
  assert.equal(parseElectricalIntent("Mutare punct electric"), "relocate");
  assert.equal(parseElectricalIntent("Demontare priză sau întrerupător"), "remove");
  assert.equal(parseElectricalIntent("Montare priză sau întrerupător"), "mechanism");
  assert.equal(parseElectricalIntent("Montare întrerupător automat"), "circuit_breaker");
  assert.equal(parseElectricalIntent("Pozare cablu electric"), "cable_route");
  // Non-electrical text is untagged.
  assert.equal(parseElectricalIntent("Montare gresie pe podea"), null);
});

test("T9: intent acts as a strong compatibility gate", () => {
  // New point must NOT match relocation, removal or mechanism-only.
  assert.ok(hasElectricalIntentConflict("new_point", "Mutare punct electric"));
  assert.ok(hasElectricalIntentConflict("new_point", "Demontare priză sau întrerupător"));
  assert.ok(hasElectricalIntentConflict("new_point", "Montare priză sau întrerupător"));
  assert.ok(!hasElectricalIntentConflict("new_point", "Executare punct electric"));
  // Relocation must NOT match demolition.
  assert.ok(hasElectricalIntentConflict("relocate", "Demontare priză sau întrerupător"));
  assert.ok(!hasElectricalIntentConflict("relocate", "Mutare punct electric"));
  // Wall switch must NOT match a panel breaker.
  assert.ok(hasElectricalIntentConflict("mechanism", "Montare întrerupător automat"));
  assert.ok(!hasElectricalIntentConflict("mechanism", "Montare priză sau întrerupător"));
  // Unknown intent on either side never conflicts.
  assert.ok(!hasElectricalIntentConflict(null, "Montare întrerupător automat"));
  assert.ok(!hasElectricalIntentConflict("mechanism", "Montare spot LED încastrat"));
});

console.log("Item-type / quantity semantics:");

test("A: пошпаклевать → labor putty; покрасить → labor paint (never material)", () => {
  const putty = tagText("пошпаклевать стены");
  assert.ok(putty.objects.has("putty"));
  const paint = tagText("покрасить стены");
  assert.ok(paint.objects.has("paint"));
});

test("B: unknown pipe length parses as quantity null (not 1)", () => {
  const parsed = jobExtractionSchema.parse({
    detectedLanguage: "ro",
    items: [
      {
        concept: "INSTALL_PIPES",
        kind: "labor",
        action: "install",
        object: null,
        surface: null,
        normalizedConcept: "install new pipes",
        rawText: "țevi noi",
        description: "Montaj țevi noi",
        quantity: null,
        unit: "m",
        confidence: 0.6,
        searchTerms: ["montaj tevi"],
      },
    ],
    assumptions: [],
    missingInformation: [],
    missingInformationText: ["Lungimea țevilor este necunoscută."],
  });
  assert.equal(parsed.items[0]!.quantity, null);
});

test("material kind is accepted (explicit product)", () => {
  const parsed = jobExtractionSchema.parse({
    detectedLanguage: "ro",
    items: [
      {
        concept: "LAMINATE_MATERIAL",
        kind: "material",
        action: "install",
        object: "flooring",
        surface: "floor",
        normalizedConcept: "laminate flooring krono",
        rawText: "20 m2 laminat Krono",
        description: "Laminat Krono",
        quantity: "20",
        unit: "m2",
        confidence: 0.8,
        searchTerms: ["laminat krono"],
      },
    ],
    assumptions: [],
    missingInformation: [],
  });
  assert.equal(parsed.items[0]!.kind, "material");
});

console.log("Semantic catalog embedding:");

test("embed-text hash is stable for identical fields", () => {
  const fields = {
    name: "Vopsea lavabilă",
    description: "Vopsea albă",
    categoryName: "Materiale",
    itemType: "material" as const,
    unit: "pcs" as const,
  };
  const a = embedTextHash(buildEmbedText(fields));
  const b = embedTextHash(buildEmbedText({ ...fields }));
  assert.equal(a, b);
});

test("embed-text hash changes when name/unit/type change", () => {
  const fields = {
    name: "Vopsea lavabilă",
    description: "Vopsea albă",
    categoryName: "Materiale",
    itemType: "material" as const,
    unit: "pcs" as const,
  };
  const base = embedTextHash(buildEmbedText(fields));
  assert.notEqual(base, embedTextHash(buildEmbedText({ ...fields, name: "X" })));
  assert.notEqual(base, embedTextHash(buildEmbedText({ ...fields, unit: "m2" })));
  assert.notEqual(
    base,
    embedTextHash(buildEmbedText({ ...fields, itemType: "labor" })),
  );
});

// --- Hybrid retrieval (fake providers, no network) -------------------------

function labelItem(overrides: Partial<CatalogItem>): CatalogItem {
  return {
    id: "id",
    organizationId: "org",
    categoryId: null,
    code: null,
    name: "name",
    description: null,
    unit: "m2",
    itemType: "labor",
    sellingPrice: "10.00",
    costPrice: null,
    currency: "MDL",
    active: true,
    ...overrides,
  };
}

function extractedItem(overrides: Partial<ExtractedItem>): ExtractedItem {
  return {
    id: "item-1",
    concept: "xyzzy",
    kind: "labor",
    action: "install",
    object: "tiles",
    surface: null,
    normalizedConcept: "xyzzy",
    rawText: "xyzzy",
    description: "xyzzy",
    quantity: null,
    unit: null,
    confidence: 0.8,
    searchTerms: ["xyzzy"],
    specifications: [],
    geometry: null,
    ...overrides,
  };
}

// Minimal fakes: only the methods the assist path touches are implemented.
function fakeRepo(opts: {
  lexical?: CatalogItem[];
  semantic?: { item: CatalogItem; similarity: number }[];
}): CatalogItemRepository {
  return {
    searchActive: async () => opts.lexical ?? [],
    semanticSearch: async () => opts.semantic ?? [],
  } as unknown as CatalogItemRepository;
}

const fakeEmbedder: EmbeddingProvider = {
  model: "fake",
  dimensions: 3,
  embed: async (texts) => texts.map(() => [0.1, 0.2, 0.3]),
};

function fakeExtraction(item: ExtractedItem): ExtractionProvider {
  return {
    extract: async () => ({
      detectedLanguage: "ro",
      items: [item],
      assumptions: [],
      missingInformation: [],
      missingInformationText: [],
    }),
  } as unknown as ExtractionProvider;
}

function fakeExtractionMany(items: ExtractedItem[]): ExtractionProvider {
  return {
    extract: async () => ({
      detectedLanguage: "ro",
      items,
      assumptions: [],
      missingInformation: [],
      missingInformationText: [],
    }),
  } as unknown as ExtractionProvider;
}

function fakeExtractionWithMissing(
  item: ExtractedItem,
  missingInformation: MissingInformationField[],
): ExtractionProvider {
  return {
    extract: async () => ({
      detectedLanguage: "ro",
      items: [item],
      assumptions: [],
      missingInformation,
      missingInformationText: [],
    }),
  } as unknown as ExtractionProvider;
}

let asyncPassed = 0;
async function atest(name: string, fn: () => Promise<void>) {
  await fn();
  asyncPassed += 1;
  console.log(`  ok - ${name}`);
}

async function runAsyncTests() {
  console.log("Hybrid retrieval (semantic fusion):");

  await atest(
    "semantic-only match (no lexical support) is capped at review, not matched",
    async () => {
      // High similarity + object/action bonuses push the score into the
      // matched band, but there is zero lexical overlap → must stay review.
      const row = labelItem({ id: "L1", name: "Montare gresie pana la 60 cm" });
      const service = new EstimateAssistantService(
        fakeExtraction(extractedItem({})),
        fakeRepo({ semantic: [{ item: row, similarity: 0.95 }] }),
        fakeEmbedder,
      );
      const res = await service.assist("org", "ro", "xyzzy");
      assert.equal(res.items[0]!.status, "review");
      assert.equal(res.items[0]!.suggestedCatalogItemId, "L1");
    },
  );

  await atest("hard unit gate excludes wrong-unit rows after merge", async () => {
    const row = labelItem({ id: "P1", name: "Montare gresie", unit: "pcs" });
    const service = new EstimateAssistantService(
      fakeExtraction(extractedItem({ unit: "m2" })),
      fakeRepo({ semantic: [{ item: row, similarity: 0.95 }] }),
      fakeEmbedder,
    );
    const res = await service.assist("org", "ro", "xyzzy");
    assert.equal(res.items[0]!.candidates.length, 0);
    assert.equal(res.items[0]!.status, "unmatched");
  });

  await atest(
    "currency gate: EUR catalog item cannot populate an MDL quote",
    async () => {
      // Strong lexical match, but the row's currency differs from the quote's.
      const row = labelItem({
        id: "C1",
        name: "gresie",
        currency: "EUR",
      });
      const service = new EstimateAssistantService(
        fakeExtraction(
          extractedItem({ concept: "gresie", searchTerms: ["gresie"] }),
        ),
        fakeRepo({ lexical: [row] }),
        fakeEmbedder,
      );
      const res = await service.assist("org", "ro", "gresie", "MDL");
      assert.equal(res.items[0]!.candidates.length, 0);
      assert.equal(res.items[0]!.status, "unmatched");
    },
  );

  await atest(
    "currency gate: matching row of the quote currency is still allowed",
    async () => {
      const row = labelItem({ id: "C2", name: "gresie", currency: "MDL" });
      const service = new EstimateAssistantService(
        fakeExtraction(
          extractedItem({ concept: "gresie", searchTerms: ["gresie"] }),
        ),
        fakeRepo({ lexical: [row] }),
        fakeEmbedder,
      );
      const res = await service.assist("org", "ro", "gresie", "MDL");
      assert.ok(res.items[0]!.candidates.some((c) => c.catalogItemId === "C2"));
    },
  );

  await atest(
    "explicit specifications cap a strong match at review (generic price must not cover a complex spec)",
    async () => {
      const row = labelItem({
        id: "D1",
        name: "Construcție perete despărțitor din gips-carton",
      });
      const item = extractedItem({
        concept: "constructie perete despartitor gips-carton",
        object: "drywall",
        searchTerms: ["constructie perete despartitor gips-carton"],
        specifications: ["gips-carton dublu", "pe ambele părți"],
      });
      const service = new EstimateAssistantService(
        fakeExtraction(item),
        fakeRepo({ lexical: [row] }),
        fakeEmbedder,
      );
      const res = await service.assist("org", "ro", "x");
      // The candidate is retrieved and suggested, but never auto-matched.
      assert.ok(res.items[0]!.candidates.some((c) => c.catalogItemId === "D1"));
      assert.equal(res.items[0]!.status, "review");
    },
  );

  await atest("embedding failure degrades to lexical-only", async () => {
    const row = labelItem({ id: "L2", name: "Montare gresie pana la 60 cm" });
    const brokenEmbedder: EmbeddingProvider = {
      model: "fake",
      dimensions: 3,
      embed: async () => {
        throw new Error("boom");
      },
    };
    const service = new EstimateAssistantService(
      fakeExtraction(
        extractedItem({ concept: "gresie", searchTerms: ["gresie"] }),
      ),
      fakeRepo({ lexical: [row] }),
      brokenEmbedder,
    );
    const res = await service.assist("org", "ro", "gresie");
    // Still returns the lexical candidate despite the embedder throwing.
    assert.ok(res.items[0]!.candidates.some((c) => c.catalogItemId === "L2"));
  });

  await atest(
    "T8: stated floor area propagates to same-surface floor ops, not to wall perimeter waterproofing",
    async () => {
      const floorRemoval = extractedItem({
        concept: "demontare gresie podea",
        action: "remove",
        object: "tiles",
        surface: "floor",
        description: "Demontare gresie de pe podea",
        quantity: "5",
        unit: "m2",
      });
      const floorWaterproofing = extractedItem({
        concept: "hidroizolatie podea",
        object: "waterproofing",
        surface: "floor",
        description: "Aplicare hidroizolație pe podea",
        quantity: null,
        unit: "m2",
      });
      const floorTile = extractedItem({
        concept: "montare gresie podea",
        object: "tiles",
        surface: "floor",
        description: "Montare gresie 60x60 pe podea",
        quantity: null,
        unit: "m2",
      });
      const wallPerimeterWaterproofing = extractedItem({
        concept: "hidroizolatie perimetru pereti",
        object: "waterproofing",
        surface: "wall",
        description: "Hidroizolație ridicată 20 cm pe pereți pe tot perimetrul",
        quantity: null,
        unit: "m2",
        specifications: ["ridicată 20 cm", "perimetral"],
      });
      const service = new EstimateAssistantService(
        fakeExtractionMany([
          floorRemoval,
          floorWaterproofing,
          floorTile,
          wallPerimeterWaterproofing,
        ]),
        fakeRepo({}),
        fakeEmbedder,
      );
      const res = await service.assist("org", "ro", "baie");
      const q = (i: number) => res.items[i]!.item.quantity;
      assert.equal(q(0), "5"); // explicit, untouched
      assert.equal(q(1), "5"); // floor waterproofing gets the floor area
      assert.equal(q(2), "5"); // new floor tile gets the floor area
      assert.equal(q(3), null); // wall perimeter waterproofing stays unknown
    },
  );

  await atest(
    "T9 (Golden Test 4): each electrical intent routes to its own catalog operation",
    async () => {
      // Shared electrical catalog (subset of the real one, all pcs unless noted).
      const catalog = [
        labelItem({ id: "E_POINT", name: "Executare punct electric", unit: "pcs" }),
        labelItem({ id: "E_MOVE", name: "Mutare punct electric", unit: "pcs" }),
        labelItem({ id: "E_REMOVE", name: "Demontare priză sau întrerupător", unit: "pcs" }),
        labelItem({ id: "E_MECH", name: "Montare priză sau întrerupător", unit: "pcs" }),
        labelItem({ id: "E_AUTO", name: "Montare întrerupător automat", unit: "pcs" }),
        labelItem({ id: "E_CABLE", name: "Pozare cablu electric", unit: "m" }),
        labelItem({ id: "E_LED", name: "Montare spot LED încastrat", unit: "pcs" }),
      ];
      const service = (item: ExtractedItem) =>
        new EstimateAssistantService(
          fakeExtraction(item),
          fakeRepo({ lexical: catalog }),
          fakeEmbedder,
        );
      const top = async (item: ExtractedItem) => {
        const res = await service(item).assist("org", "ro", "x");
        return res.items[0]!;
      };
      const has = (row: MatchedItem, id: string) =>
        row.candidates.some((c) => c.catalogItemId === id);

      // 8 new points → Executare punct electric; never relocate/remove/mechanism.
      const newPoint = await top(
        extractedItem({
          concept: "punct nou priza", object: "socket", unit: "pcs", quantity: "8",
          description: "Montare 8 puncte noi pentru prize, cu cablu și doză",
          rawText: "8 puncte noi pentru prize, cu cablu și doză",
          searchTerms: ["priza", "punct electric", "punct nou"],
          specifications: ["cu cablu și doză"],
        }),
      );
      assert.equal(newPoint.candidates[0]!.catalogItemId, "E_POINT");
      assert.ok(!has(newPoint, "E_MOVE") && !has(newPoint, "E_REMOVE") && !has(newPoint, "E_MECH"));

      // 2 relocated sockets → Mutare punct electric; never demolition.
      const relocate = await top(
        extractedItem({
          concept: "mutare priza", object: "socket", unit: "pcs", quantity: "2",
          description: "Mutarea a 2 prize existente cu aproximativ 60 cm",
          rawText: "La două prize existente mutăm punctul cu aproximativ 60 cm",
          searchTerms: ["priza", "mutare punct"],
        }),
      );
      assert.equal(relocate.candidates[0]!.catalogItemId, "E_MOVE");
      assert.ok(!has(relocate, "E_REMOVE"));

      // 3 wall switches → Montare priză sau întrerupător; never the breaker.
      const wallSwitch = await top(
        extractedItem({
          concept: "montare intrerupator", object: "socket", unit: "pcs", quantity: "3",
          description: "Montare 3 întrerupătoare de lumină",
          rawText: "Mai punem 3 întrerupătoare de lumină",
          searchTerms: ["intrerupator", "priza"],
        }),
      );
      assert.equal(wallSwitch.candidates[0]!.catalogItemId, "E_MECH");
      assert.ok(!has(wallSwitch, "E_AUTO"));

      // cable circuit → Pozare cablu electric (unit m), quantity unknown.
      const cable = await top(
        extractedItem({
          concept: "pozare cablu", object: null, unit: "m", quantity: null,
          description: "Pozare circuit separat pentru cuptor până în tablou",
          rawText: "Pentru cuptor tragem un circuit separat până în tablou",
          searchTerms: ["cablu", "circuit", "traseu"],
        }),
      );
      assert.equal(cable.candidates[0]!.catalogItemId, "E_CABLE");

      // 1 breaker 20A → Montare întrerupător automat; never the wall-switch row.
      const breaker = await top(
        extractedItem({
          concept: "montare automat", object: null, unit: "pcs", quantity: "1",
          description: "Montare întrerupător automat de 20A",
          rawText: "și punem un automat de 20A",
          searchTerms: ["automat", "disjunctor"],
          specifications: ["20A"],
        }),
      );
      assert.equal(breaker.candidates[0]!.catalogItemId, "E_AUTO");
      assert.ok(!has(breaker, "E_MECH"));

      // 2 LED spots → Montare spot LED (no electrical intent gate applies).
      const led = await top(
        extractedItem({
          concept: "montare spot led", object: null, unit: "pcs", quantity: "2",
          description: "Montare 2 spoturi LED deasupra blatului",
          rawText: "Și montăm 2 spoturi LED deasupra blatului",
          searchTerms: ["spot led", "spot"],
        }),
      );
      assert.equal(led.candidates[0]!.catalogItemId, "E_LED");
    },
  );

  await atest(
    "missing-information recalc updates quantity deterministically without re-extraction",
    async () => {
      const item = extractedItem({
        id: "item-1",
        concept: "pozare teava apa rece",
        object: "pipe",
        unit: "m",
        quantity: null,
      });
      const missingField: MissingInformationField = {
        id: "missing-1",
        label: "Lungimea țevii de apă rece",
        question: "Introduceți lungimea",
        relatedItemId: "item-1",
        target: { type: "item_quantity", key: null },
        inputType: "number",
        unit: "m",
        options: [],
        required: true,
      };
      const service = new EstimateAssistantService(
        fakeExtractionWithMissing(item, [missingField]),
        fakeRepo({}),
        fakeEmbedder,
      );
      const before = await service.assist("org", "ro", "țevi");
      const after = await service.recalculateWithMissingInformation(
        "org",
        before,
        { "missing-1": "12" },
      );
      assert.equal(after.items[0]!.item.quantity, "12");
      assert.equal(after.items[0]!.item.unit, "m");
      assert.equal(after.missingInformation.length, 0);
    },
  );
}

runAsyncTests()
  .then(() => {
    console.log(`\n${passed + asyncPassed} checks passed.`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });