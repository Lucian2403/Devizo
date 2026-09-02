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
} from "../domain/ai/concepts";
import { jobExtractionSchema } from "../schemas/domain/aiExtraction";
import { rectangleArea, roomWallArea } from "../domain/quotes/geometry";
import { buildEmbedText, embedTextHash } from "../domain/ai/catalogEmbedding";
import { EstimateAssistantService } from "../domain/ai/estimate.service";
import type { CatalogItem, CatalogItemRepository } from "../domain/catalog/item.repository";
import type { EmbeddingProvider } from "../domain/ai/embedding.provider";
import type { ExtractionProvider } from "../domain/ai/providers";
import type {
  ExtractedItem,
  MatchCandidate,
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
    missingInformation: ["Lungimea țevilor este necunoscută."],
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
    active: true,
    ...overrides,
  };
}

function extractedItem(overrides: Partial<ExtractedItem>): ExtractedItem {
  return {
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
}

runAsyncTests()
  .then(() => {
    console.log(`\n${passed + asyncPassed} checks passed.`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });