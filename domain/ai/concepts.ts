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
  "primer",
  "paint",
  "flooring",
  "socket",
  "mesh",
  "waterproofing",
  "sanitaryware",
  "pipe",
  "other",
] as const;
export type WorkObject = (typeof WORK_OBJECTS)[number];

// The surface a work item acts on. Kept separate from the object so wall vs
// floor vs ceiling work never matches the wrong catalog row (e.g. floor tile
// vs wall tile). "other" means no clear surface — it never conflicts.
export const WORK_SURFACES = ["wall", "floor", "ceiling", "other"] as const;
export type WorkSurface = (typeof WORK_SURFACES)[number];

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
  // Priming/undercoat — a distinct operation from putty, so "amorsare tavan"
  // never matches a "glet tavan" (putty) catalog row on the shared surface.
  primer: [
    "amorsa",
    "amorsare",
    "amorsaj",
    "grund",
    "grunduire",
    "грунт",
    "грунтовка",
    "праймер",
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
  // Waterproofing is its own operation — never tile installation nor fiberglass
  // reinforcement. Blocks "hidroizolatie podea" from matching a gresie/faianta
  // or a fibra-de-sticla catalog row on the same surface.
  waterproofing: [
    "hidroizolatie",
    "hidroizolare",
    "hidroizolant",
    "izolatie hidrofuga",
    "membrana hidroizolanta",
    "гидроизоляция",
    "гидроизоляцию",
    "гидроизоляр",
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
    "robinet",
    "robineti",
    "унитаз",
    "раковина",
    "умывальник",
    "душ",
    "ванна",
    "биде",
    "смесител",
    "кран",
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

// Normalized keyword lists per surface. Romanian/Russian construction words.
const SURFACE_KEYWORDS: Record<Exclude<WorkSurface, "other">, string[]> = {
  wall: ["perete", "pereti", "peretii", "zid", "ziduri", "стен", "настенн"],
  ceiling: ["tavan", "tavane", "tavanul", "plafon", "потолок", "потолоч"],
  floor: [
    "podea",
    "pardoseala",
    "pardoseli",
    "pardoseala",
    "напольн",
    "полов",
  ],
};

export interface WorkTags {
  actions: Set<WorkAction>;
  objects: Set<WorkObject>;
  surfaces: Set<WorkSurface>;
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

const NON_SANITARY_BATTERY_WORDS = [
  "acumulator",
  "acumulatori",
  "litiu",
  "ups",
  "radiator",
  "calorifer",
];

function textLooksLikeSanitaryMixer(normalized: string): boolean {
  if (!textMatchesKeyword(normalized, "baterie")) return false;
  return !NON_SANITARY_BATTERY_WORDS.some((word) => normalized.includes(word));
}

// Purpose markers introduce a secondary/context clause, not the primary
// operation: "Glet tavan PENTRU vopsire" is putty, painting is only its intent.
// Everything from such a marker to the next clause break is dropped before
// tagging the primary action/object, so the row is not mis-tagged as paint.
const PURPOSE_MARKERS = ["pentru", "sub", "pt", "под"];

// Removes trailing purpose clauses so secondary intent words ("... pentru
// vopsire") never become primary action/object tags. Surface words normally
// precede the marker ("tavan pentru vopsire") and are therefore preserved.
function stripPurposeClauses(normalized: string): string {
  const markers = PURPOSE_MARKERS.join("|");
  return normalized.replace(
    new RegExp(`(?<![a-z0-9])(?:${markers})\\s+[^,;.]*`, "gu"),
    " ",
  );
}

// Derives action/object tags from arbitrary text (a catalog row's name +
// description + code, or the original sentence).
export function tagText(text: string): WorkTags {
  const normalized = normalizeText(text);
  // Primary-operation view: secondary "for painting"-style intent is stripped
  // so action/object tags reflect what the item actually IS, not its purpose.
  const primary = stripPurposeClauses(normalized);
  const actions = new Set<WorkAction>();
  const objects = new Set<WorkObject>();
  const surfaces = new Set<WorkSurface>();

  for (const action of Object.keys(ACTION_KEYWORDS) as Exclude<
    WorkAction,
    "other"
  >[]) {
    if (
      ACTION_KEYWORDS[action].some((kw) => textMatchesKeyword(primary, kw))
    ) {
      actions.add(action);
    }
  }
  for (const object of Object.keys(OBJECT_KEYWORDS) as Exclude<
    WorkObject,
    "other"
  >[]) {
    if (
      OBJECT_KEYWORDS[object].some((kw) => textMatchesKeyword(primary, kw))
    ) {
      objects.add(object);
    }
  }
  if (textLooksLikeSanitaryMixer(primary)) {
    objects.add("sanitaryware");
  }
  for (const surface of Object.keys(SURFACE_KEYWORDS) as Exclude<
    WorkSurface,
    "other"
  >[]) {
    if (
      SURFACE_KEYWORDS[surface].some((kw) => textMatchesKeyword(normalized, kw))
    ) {
      surfaces.add(surface);
    }
  }
  return { actions, objects, surfaces };
}

// Returns true when a candidate's tags strongly conflict with the extracted
// item's action/object and must therefore be excluded (prefer NO_MATCH).
export function hasStrongConflict(
  itemAction: WorkAction,
  itemObject: WorkObject | null,
  candidate: WorkTags,
  // The surface the extracted item acts on (wall/floor/ceiling), when known.
  itemSurface: WorkSurface | null = null,
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
  // Surface conflict: both sides name a specific surface and they are disjoint
  // (e.g. floor tile item vs wall tile catalog row). Blocks the wrong match.
  if (
    itemSurface &&
    itemSurface !== "other" &&
    candidate.surfaces.size > 0 &&
    !candidate.surfaces.has(itemSurface)
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

// Picks the single canonical surface for an extracted item from arbitrary text
// (its surface field + description + concept). Returns null when unclear.
export function pickSurface(text: string): WorkSurface | null {
  const { surfaces } = tagText(text);
  // A single unambiguous surface only; mixed/absent stays null (no conflict).
  if (surfaces.size !== 1) return null;
  const [only] = surfaces;
  return only ?? null;
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

/**
 * Minimal technical-role metadata for DRYWALL PROFILES. A drywall profile is
 * not a generic "profil": partition studs/tracks (CW/UW, 50/75/100 mm) are
 * mechanically different from ceiling profiles (CD 60/27, UD 28/27). Selecting
 * a CD ceiling profile for a partition wall is a technical error, so we tag a
 * canonical role from text on BOTH sides and treat cross-family as a conflict.
 *
 * Derived from text, not stored in the DB — no schema change. Roles are only
 * inferred when the text clearly refers to a profile, so unrelated rows (e.g.
 * "vată minerală 75 mm") are never tagged.
 */
export const PROFILE_ROLES = [
  "partition_stud", // CW — vertical stud in a partition wall
  "partition_track", // UW — floor/ceiling track of a partition wall
  "ceiling_profile", // CD 60/27 — suspended-ceiling main profile
  "ceiling_track", // UD 28/27 — perimeter track for ceilings
  "other",
] as const;
export type ProfileRole = (typeof PROFILE_ROLES)[number];

// Which physical family a role belongs to. Cross-family = incompatible.
const PROFILE_FAMILY: Record<Exclude<ProfileRole, "other">, "partition" | "ceiling"> = {
  partition_stud: "partition",
  partition_track: "partition",
  ceiling_profile: "ceiling",
  ceiling_track: "ceiling",
};

// True when the text clearly refers to a (drywall) metal profile at all.
function mentionsProfile(normalized: string): boolean {
  return /(?<![a-z0-9])(profil|profile|профил|профиль)/u.test(normalized);
}

// Derives drywall profile role(s) from arbitrary text (a requirement phrase or
// a catalog row). Explicit letter codes win; otherwise a stated partition size
// (50/75/100 mm) on a profile implies a partition stud. Returns an empty set
// when the text is not clearly about a drywall profile.
export function tagProfileRoles(text: string): Set<ProfileRole> {
  const n = normalizeText(text);
  const roles = new Set<ProfileRole>();

  const hasCode = (kw: string) => textMatchesKeyword(n, kw);

  if (hasCode("cw")) roles.add("partition_stud");
  if (hasCode("uw")) roles.add("partition_track");
  if (hasCode("cd") || /60\s*[\/x]\s*27/u.test(n)) roles.add("ceiling_profile");
  if (hasCode("ud") || /28\s*[\/x]\s*27/u.test(n)) roles.add("ceiling_track");

  // Size-based inference only when it is clearly a profile and no explicit
  // ceiling/partition code was found. Partition profiles come in 50/75/100 mm.
  if (roles.size === 0 && mentionsProfile(n)) {
    if (/(?<![0-9])(50|75|100)(?![0-9])/u.test(n)) {
      roles.add("partition_stud");
    }
  }
  return roles;
}

// True when a required profile role and a candidate profile role belong to
// different families (partition vs ceiling) and must therefore not match.
// No conflict when either side is untagged (unknown), so non-profile rows and
// generic requirements are unaffected.
export function hasProfileRoleConflict(
  required: Set<ProfileRole>,
  candidate: Set<ProfileRole>,
): boolean {
  const fams = (set: Set<ProfileRole>) => {
    const out = new Set<"partition" | "ceiling">();
    for (const r of set) if (r !== "other") out.add(PROFILE_FAMILY[r]);
    return out;
  };
  const reqFam = fams(required);
  const candFam = fams(candidate);
  if (reqFam.size === 0 || candFam.size === 0) return false;
  for (const f of reqFam) if (candFam.has(f)) return false;
  return true;
}

// Converts a numeric literal + unit to millimetres. Handles comma decimals.
function toMm(value: string, unit: string): number {
  const n = Number.parseFloat(value.replace(",", "."));
  return unit === "cm" ? n * 10 : n;
}

/**
 * Extracts a canonical material THICKNESS in millimetres from text, when one is
 * explicitly stated. Used to block a technically wrong material (e.g. a 50 mm
 * mineral-wool board for a required 75 mm one). Returns null when no thickness
 * is stated — unknown never conflicts. Only mm/cm are recognised (m²/ml are
 * areas/lengths, not thickness).
 */
export function parseThicknessMm(text: string): number | null {
  const n = normalizeText(text);

  // 1) Explicit "grosime 75 mm" / "grosime de 5 cm".
  let m = n.match(
    /(?:grosime[a]?|gros\.)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(mm|cm)/u,
  );
  if (m) return toMm(m[1]!, m[2]!);

  // 2) Dimension triple "100x60x5 cm" → thickness is the smallest dimension.
  m = n.match(
    /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm)/u,
  );
  if (m) {
    const dims = [m[1]!, m[2]!, m[3]!].map((v) =>
      Number.parseFloat(v.replace(",", ".")),
    );
    const min = Math.min(...dims);
    return m[4] === "cm" ? min * 10 : min;
  }

  // 3) Standalone "75 mm" / "5 cm" (not part of a larger number or dimension).
  m = n.match(/(?<![0-9x×.,])(\d+(?:[.,]\d+)?)\s*(mm|cm)(?![0-9²])/u);
  if (m) return toMm(m[1]!, m[2]!);

  return null;
}

// True when the required thickness and a candidate's known thickness differ.
// Both must be explicitly stated; an unknown thickness on either side never
// conflicts, so materials without a stated thickness are left to normal ranking.
export function hasThicknessConflict(
  requiredMm: number | null,
  candidateText: string,
): boolean {
  if (requiredMm === null) return false;
  const candidateMm = parseThicknessMm(candidateText);
  if (candidateMm === null) return false;
  return Math.abs(candidateMm - requiredMm) > 0.5;
}

// Mounting type for sanitary fixtures (mainly WC). A wall-hung / concealed unit
// is a different product from a floor-mounted one, so we treat them as opposite
// and block a cross-mount match.
export type MountType = "suspended" | "floor" | null;

const SUSPENDED_KEYWORDS = [
  "suspendat",
  "incastrat",
  "incastrata",
  "inzidit",
  "подвесной",
  "инсталляц",
  "встроенн",
];
const FLOOR_MOUNT_KEYWORDS = [
  "pe pardoseala",
  "pe podea",
  "de pardoseala",
  "напольн",
  "приставн",
];

// Derives the sanitary mounting type from text, or null when unspecified.
export function parseMountType(text: string): MountType {
  const n = normalizeText(text);
  if (SUSPENDED_KEYWORDS.some((kw) => textMatchesKeyword(n, kw))) {
    return "suspended";
  }
  if (FLOOR_MOUNT_KEYWORDS.some((kw) => n.includes(kw))) return "floor";
  return null;
}

// True when the required mount type and the candidate's known mount type are
// opposite (suspended vs floor). Unknown on either side never conflicts.
export function hasMountTypeConflict(
  required: MountType,
  candidateText: string,
): boolean {
  if (required === null) return false;
  const candidate = parseMountType(candidateText);
  if (candidate === null) return false;
  return candidate !== required;
}

/**
 * Electrical intent taxonomy. Electrical requests differ by the OPERATION, not
 * just the object: a brand-new point, moving an existing one, a wall switch, a
 * panel breaker and a cable run are distinct catalog operations with different
 * prices. Both the extracted item and each catalog row are tagged, and matching
 * uses the intent as a STRONG compatibility gate so explicit action semantics
 * outrank generic token similarity.
 */
export const ELECTRICAL_INTENTS = [
  "new_point", // new point incl. wiring/box/prep → "Executare punct electric"
  "relocate", // move an existing point/socket → "Mutare punct electric"
  "remove", // demolish/remove a point → "Demontare priză"
  "mechanism", // fit socket/wall switch mechanism → "Montare priză/întrerupător"
  "circuit_breaker", // panel breaker/automat → "Montare întrerupător automat"
  "cable_route", // run/lay cable → "Pozare cablu electric"
] as const;
export type ElectricalIntent = (typeof ELECTRICAL_INTENTS)[number];

// Words that anchor a text as electrical at all. Without one of these the text
// is not electrical and gets no intent (so non-electrical rows never gate).
const ELECTRICAL_ANCHORS = [
  "priza",
  "prize",
  "intrerupator",
  "intrerupatoare",
  "punct electric",
  "puncte electrice",
  "punct nou",
  "puncte noi",
  "cablu",
  "doza",
  "doze",
  "automat",
  "disjunctor",
  "circuit",
  "tablou",
  "выключател",
  "розет",
  "автомат",
];

// Derives the electrical intent from arbitrary text (item or catalog row), or
// null when the text is not clearly electrical. Order matters: more specific
// operations are tested first so a shared word (e.g. "punct", "întrerupător")
// does not leak into a broader bucket ("Mutare punct" is relocate, not a new
// point; "întrerupător automat" is a breaker, not a wall switch).
export function parseElectricalIntent(text: string): ElectricalIntent | null {
  const n = normalizeText(text);
  if (!ELECTRICAL_ANCHORS.some((a) => n.includes(a))) return null;
  const has = (kw: string) => textMatchesKeyword(n, kw);
  const any = (kws: string[]) => kws.some(has);

  // 1) Panel breaker — "automat"/"disjunctor" must win over the generic
  //    "întrerupător" so a breaker never reads as a wall switch.
  if (has("automat") || has("disjunctor") || n.includes("автомат")) {
    return "circuit_breaker";
  }
  // 2) Relocation — checked before new_point/mechanism because it also mentions
  //    a point/socket ("Mutare punct electric", "mutăm priza").
  if (any(["mutare", "mutarea", "mutam", "muta", "mutat", "deplasare", "deplasam"]) ||
      n.includes("перенос") || n.includes("перемещ")) {
    return "relocate";
  }
  // 3) Removal — explicit demolition of an electrical point.
  if (any(["demontare", "demontaj", "demontam", "demolare", "scoatere", "desfacere"]) ||
      n.includes("демонтаж") || n.includes("снят")) {
    return "remove";
  }
  // 4) New point — explicit "new" point/socket/box, or a socket/point combined
  //    with pulling cable (wiring + box + mechanism as one operation).
  const newPoint = any([
    "punct nou",
    "puncte noi",
    "punct electric",
    "puncte electrice",
    "executare punct",
    "priza noua",
    "prize noi",
    "doza noua",
    "doze noi",
  ]);
  const mentionsSocketOrPoint = any(["priza", "prize", "punct", "puncte", "doza", "doze"]);
  const mentionsCable = has("cablu") || has("tras") || has("tragem");
  if (newPoint || (mentionsSocketOrPoint && mentionsCable)) return "new_point";

  // 5) Cable run — laying/routing cable or a circuit to the panel, with no
  //    socket/point target of its own.
  if (has("pozare") || has("cablu") || has("traseu") ||
      (has("circuit") && n.includes("tablou"))) {
    return "cable_route";
  }
  // 6) Mechanism — fitting a socket or a (non-automatic) wall switch.
  if (mentionsSocketOrPoint || has("intrerupator") || has("intrerupatoare") ||
      n.includes("выключател")) {
    return "mechanism";
  }
  return null;
}

// True when an item's electrical intent and a candidate row's electrical intent
// are both known and different. Acts as a strong compatibility gate: a new point
// never matches relocation/removal/mechanism, a wall switch never matches a
// breaker, etc. Unknown intent on either side never conflicts.
export function hasElectricalIntentConflict(
  itemIntent: ElectricalIntent | null,
  candidateText: string,
): boolean {
  if (itemIntent === null) return false;
  const candidate = parseElectricalIntent(candidateText);
  if (candidate === null) return false;
  return candidate !== itemIntent;
}
