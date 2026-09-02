import { normalizeText } from "./matching";

/**
 * Shared work-semantics taxonomy for safe catalog matching.
 *
 * The LLM classifies each extracted item into a canonical `action` + `object`.
 * Deterministic keyword tagging derives the same tags from a catalog row's
 * text. Matching then applies COMPATIBILITY FILTERING (strong action/object
 * conflicts exclude a candidate) before ranking — so a wrong match is avoided
 * in favour of NO_MATCH.
 *
 * Keywords cover Romanian, Russian and common Moldovan construction jargon.
 * All keyword literals must be written already normalized (lowercase, no
 * diacritics), because tagging compares against normalizeText(...) output.
 */

export const WORK_ACTIONS = [
  "remove", // demolish / strip / take down
  "install", // mount / lay / build
  "prepare", // putty / plaster / prime (surface prep)
  "finish", // paint / whitewash / final coat
  "repair", // fix / patch
  "other",
] as const;
export type WorkAction = (typeof WORK_ACTIONS)[number];

export const WORK_OBJECTS = [
  "wallpaper",
  "tiles",
  "drywall",
  "screed",
  "plaster",
  "putty",
  "paint",
  "flooring",
  "socket",
  "mesh",
  "sanitaryware",
  "pipe",
  "other",
] as const;
export type WorkObject = (typeof WORK_OBJECTS)[number];

// Actions considered strongly opposite: doing one rules out the other.
const OPPOSITE_ACTION: Partial<Record<WorkAction, WorkAction>> = {
  remove: "install",
  install: "remove",
};

// Normalized keyword lists per action.
const ACTION_KEYWORDS: Record<Exclude<WorkAction, "other">, string[]> = {
  remove: [
    "demontare",
    "demontaj",
    "demolare",
    "indepartare",
    "indepartarea",
    "scoatere",
    "dat jos",
    "desfacere",
    "inlaturare",
    "demont",
    "снять",
    "снятие",
    "демонтаж",
    "удаление",
  ],
  install: [
    "montare",
    "montaj",
    "montarea",
    "instalare",
    "instalarea",
    "punere",
    "pozare",
    "asezare",
    "placare",
    "construire",
    "constructie",
    "aplicare",
    "монтаж",
    "установка",
    "укладка",
  ],
  prepare: [
    "glet",
    "gletuire",
    "spacluire",
    "spaccluire",
    "spacliovca",
    "spaclu",
    "amorsare",
    "grunduire",
    "tencuire",
    "tencuiala",
    "pregatire",
    "шпаклевка",
    "шпаклёвка",
    "шпаклева",
    "штукатурка",
    "грунтовка",
  ],
  finish: [
    "vopsire",
    "vopsit",
    "vopsea",
    "zugravire",
    "zugraveala",
    "driscuire",
    "покраска",
    "окраска",
    "побелка",
  ],
  repair: ["reparare", "reparatie", "reparatii", "ремонт", "починка"],
};

// Normalized keyword lists per object. Order-independent; a row may carry more
// than one object tag (e.g. "Glet pereți pentru vopsire" → putty + paint).
const OBJECT_KEYWORDS: Record<Exclude<WorkObject, "other">, string[]> = {
  wallpaper: ["tapet", "tapetul", "oboi", "обои", "обоев"],
  tiles: [
    "faianta",
    "gresie",
    "placi ceramice",
    "placa ceramica",
    "placaj ceramic",
    "placaje ceramice",
    "ceramica",
    "mozaic",
    "плитка",
    "плитки",
    "плитку",
    "кафель",
  ],
  drywall: [
    "gips-carton",
    "gips carton",
    "gipscarton",
    "rigips",
    "гипсокартон",
    "гкл",
  ],
  screed: ["sapa", "sape", "stiasca", "stiajca", "стяжка", "стяжку"],
  plaster: ["tencuiala", "tencuieli", "tencuire", "штукатурка"],
  putty: [
    "glet",
    "gletuire",
    "spacluire",
    "spaccluire",
    "spacliovca",
    "spaclu",
    "шпаклевка",
    "шпаклёвка",
    "шпаклева",
  ],
  paint: [
    "vopsea",
    "vopsire",
    "vopsit",
    "zugraveala",
    "zugravire",
    "краска",
    "покраска",
    "окраска",
    "покрас",
    "крас",
  ],
  flooring: [
    "laminat",
    "parchet",
    "linoleum",
    "mocheta",
    "pardoseala",
    "ламинат",
    "паркет",
    "линолеум",
  ],
  socket: [
    "priza",
    "prize",
    "rozetca",
    "rozetka",
    "intrerupator",
    "розетка",
    "выключатель",
  ],
  mesh: [
    "plasa",
    "plasa de armare",
    "fibra de sticla",
    "fibra",
    "сетка",
    "стеклохолст",
  ],
  sanitaryware: [
    "wc",
    "vas wc",
    "toaleta",
    "closet",
    "lavoar",
    "chiuveta",
    "lavabou",
    "dus",
    "cabina de dus",
    "cadita",
    "cada",
    "bideu",
    "унитаз",
    "раковина",
    "умывальник",
    "душ",
    "ванна",
    "биде",
  ],
  pipe: [
    "teava",
    "tevi",
    "conducta",
    "conducte",
    "canalizare",
    "scurgere",
    "racord",
    "труба",
    "трубы",
    "канализация",
  ],
};

// Jargon / cross-language token → canonical Romanian catalog word(s). Used to
// widen retrieval so input like "șpacliovcă" still finds catalog "glet".
const JARGON_EXPANSIONS: Record<string, string[]> = {
  spacliovca: ["glet", "spacluire"],
  spacluire: ["glet"],
  spaclu: ["glet"],
  шпаклевка: ["glet"],
  шпаклёвка: ["glet"],
  oboi: ["tapet"],
  обои: ["tapet"],
  potoloc: ["tavan"],
  потолок: ["tavan"],
  rozetca: ["priza"],
  rozetka: ["priza"],
  розетка: ["priza"],
  stiasca: ["sapa"],
  stiajca: ["sapa"],
  стяжка: ["sapa"],
  tevi: ["teava"],
  conducte: ["conducta"],
  кафель: ["faianta", "gresie"],
  плитка: ["faianta", "gresie"],
  краска: ["vopsea"],
  покраска: ["vopsire"],
};

export interface WorkTags {
  actions: Set<WorkAction>;
  objects: Set<WorkObject>;
}

// Keyword test that avoids the "demontare" ⊃ "montare" trap. A keyword matches
// only when it is NOT preceded by a Latin letter or digit, so the Romanian
// reversing prefix "de-" (de+montare → remove, not install) is rejected while
// word starts, spaces and Cyrillic aspectual prefixes (по+шпаклевать) still
// match. Suffix inflections are unaffected ("montarea", "montaj").
function textMatchesKeyword(normalized: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escaped}`, "u").test(normalized);
}

// Derives action/object tags from arbitrary text (a catalog row's name +
// description + code, or the original sentence).
export function tagText(text: string): WorkTags {
  const normalized = normalizeText(text);
  const actions = new Set<WorkAction>();
  const objects = new Set<WorkObject>();

  for (const action of Object.keys(ACTION_KEYWORDS) as Exclude<
    WorkAction,
    "other"
  >[]) {
    if (
      ACTION_KEYWORDS[action].some((kw) => textMatchesKeyword(normalized, kw))
    ) {
      actions.add(action);
    }
  }
  for (const object of Object.keys(OBJECT_KEYWORDS) as Exclude<
    WorkObject,
    "other"
  >[]) {
    if (
      OBJECT_KEYWORDS[object].some((kw) => textMatchesKeyword(normalized, kw))
    ) {
      objects.add(object);
    }
  }
  return { actions, objects };
}

// Returns true when a candidate's tags strongly conflict with the extracted
// item's action/object and must therefore be excluded (prefer NO_MATCH).
export function hasStrongConflict(
  itemAction: WorkAction,
  itemObject: WorkObject | null,
  candidate: WorkTags,
): boolean {
  // Object conflict: both sides name a specific, different object.
  if (
    itemObject &&
    itemObject !== "other" &&
    candidate.objects.size > 0 &&
    !candidate.objects.has(itemObject)
  ) {
    return true;
  }
  // Action conflict: remove vs install (and vice-versa) on the candidate.
  const opposite = OPPOSITE_ACTION[itemAction];
  if (
    opposite &&
    candidate.actions.size > 0 &&
    !candidate.actions.has(itemAction) &&
    candidate.actions.has(opposite)
  ) {
    return true;
  }
  return false;
}

// Expands a search term with any jargon/cross-language canonical equivalents so
// retrieval can reach catalog rows written with different vocabulary.
export function expandJargon(term: string): string[] {
  const out = new Set<string>();
  for (const token of normalizeText(term).split(/[^\p{L}\p{N}]+/u)) {
    if (token.length < 2) continue;
    const expansions = JARGON_EXPANSIONS[token];
    if (expansions) for (const e of expansions) out.add(e);
  }
  return [...out];
}
