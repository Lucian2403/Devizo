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

const PURPOSE_MARKERS = ["pentru", "sub", "pt", "под"];

function stripPurposeClauses(normalized: string): string {
  const markers = PURPOSE_MARKERS.join("|");
  return normalized.replace(
    new RegExp(`(?<![a-z0-9])(?:${markers})\\s+[^,;.]*`, "gu"),
    " ",
  );
}

export function tagText(text: string): WorkTags {
  const normalized = normalizeText(text);
  const primary = stripPurposeClauses(normalized);
  const actions = new Set<WorkAction>();
  const objects = new Set<WorkObject>();
  const surfaces = new Set<WorkSurface>();

  for (const action of Object.keys(ACTION_KEYWORDS) as Exclude<
    WorkAction,
    "other"
  >[]) {
    if (ACTION_KEYWORDS[action].some((kw) => textMatchesKeyword(primary, kw))) {
      actions.add(action);
    }
  }
  for (const object of Object.keys(OBJECT_KEYWORDS) as Exclude<
    WorkObject,
    "other"
  >[]) {
    if (OBJECT_KEYWORDS[object].some((kw) => textMatchesKeyword(primary, kw))) {
      objects.add(object);
    }
  }
  if (textLooksLikeSanitaryMixer(primary)) objects.add("sanitaryware");

  for (const surface of Object.keys(SURFACE_KEYWORDS) as Exclude<
    WorkSurface,
    "other"
  >[]) {
    if (SURFACE_KEYWORDS[surface].some((kw) => textMatchesKeyword(normalized, kw))) {
      surfaces.add(surface);
    }
  }

  return { actions, objects, surfaces };
}

export function hasStrongConflict(
  itemAction: WorkAction,
  itemObject: WorkObject | null,
  candidate: WorkTags,
  itemSurface: WorkSurface | null = null,
): boolean {
  if (
    itemObject &&
    itemObject !== "other" &&
    candidate.objects.size > 0 &&
    !candidate.objects.has(itemObject)
  ) {
    return true;
  }
  if (
    itemSurface &&
    itemSurface !== "other" &&
    candidate.surfaces.size > 0 &&
    !candidate.surfaces.has(itemSurface)
  ) {
    return true;
  }
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

export function pickSurface(text: string): WorkSurface | null {
  const { surfaces } = tagText(text);
  if (surfaces.size !== 1) return null;
  const [only] = surfaces;
  return only ?? null;
}

export function expandJargon(term: string): string[] {
  const out = new Set<string>();
  for (const token of normalizeText(term).split(/[^\p{L}\p{N}]+/u)) {
    if (token.length < 2) continue;
    const expansions = JARGON_EXPANSIONS[token];
    if (expansions) for (const e of expansions) out.add(e);
  }
  return [...out];
}

export const PROFILE_ROLES = [
  "partition_stud",
  "partition_track",
  "ceiling_profile",
  "ceiling_track",
  "other",
] as const;
export type ProfileRole = (typeof PROFILE_ROLES)[number];

const PROFILE_FAMILY: Record<Exclude<ProfileRole, "other">, "partition" | "ceiling"> = {
  partition_stud: "partition",
  partition_track: "partition",
  ceiling_profile: "ceiling",
  ceiling_track: "ceiling",
};

function mentionsProfile(normalized: string): boolean {
  return /(?<![a-z0-9])(profil|profile|профил|профиль)/u.test(normalized);
}

export function tagProfileRoles(text: string): Set<ProfileRole> {
  const n = normalizeText(text);
  const roles = new Set<ProfileRole>();
  const hasCode = (kw: string) => textMatchesKeyword(n, kw);

  if (hasCode("cw")) roles.add("partition_stud");
  if (hasCode("uw")) roles.add("partition_track");
  if (hasCode("cd") || /60\s*[\/x]\s*27/u.test(n)) roles.add("ceiling_profile");
  if (hasCode("ud") || /28\s*[\/x]\s*27/u.test(n)) roles.add("ceiling_track");

  if (roles.size === 0 && mentionsProfile(n)) {
    if (/(?<![0-9])(50|75|100)(?![0-9])/u.test(n)) roles.add("partition_stud");
  }
  return roles;
}

export function hasProfileRoleConflict(
  required: Set<ProfileRole>,
  candidate: Set<ProfileRole>,
): boolean {
  const fams = (set: Set<ProfileRole>) => {
    const out = new Set<"partition" | "ceiling">();
    for (const role of set) if (role !== "other") out.add(PROFILE_FAMILY[role]);
    return out;
  };

  const requiredFamilies = fams(required);
  const candidateFamilies = fams(candidate);
  if (requiredFamilies.size === 0 || candidateFamilies.size === 0) return false;
  for (const family of requiredFamilies) {
    if (candidateFamilies.has(family)) return false;
  }
  return true;
}

function toMm(value: string, unit: string): number {
  const n = Number.parseFloat(value.replace(",", "."));
  return unit === "cm" ? n * 10 : n;
}

export function parseThicknessMm(text: string): number | null {
  const n = normalizeText(text);

  let m = n.match(
    /(?:grosime[a]?|gros\.)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(mm|cm)/u,
  );
  if (m) return toMm(m[1]!, m[2]!);

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

  m = n.match(/(?<![0-9x×.,])(\d+(?:[.,]\d+)?)\s*(mm|cm)(?![0-9²])/u);
  if (m) return toMm(m[1]!, m[2]!);

  return null;
}

export function hasThicknessConflict(
  requiredMm: number | null,
  candidateText: string,
): boolean {
  if (requiredMm === null) return false;
  const candidateMm = parseThicknessMm(candidateText);
  if (candidateMm === null) return false;
  return Math.abs(candidateMm - requiredMm) > 0.5;
}

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

export function parseMountType(text: string): MountType {
  const n = normalizeText(text);
  if (SUSPENDED_KEYWORDS.some((kw) => textMatchesKeyword(n, kw))) {
    return "suspended";
  }
  if (FLOOR_MOUNT_KEYWORDS.some((kw) => n.includes(kw))) return "floor";
  return null;
}

export function hasMountTypeConflict(
  required: MountType,
  candidateText: string,
): boolean {
  if (required === null) return false;
  const candidate = parseMountType(candidateText);
  if (candidate === null) return false;
  return candidate !== required;
}

export const ELECTRICAL_INTENTS = [
  "new_point",
  "relocate",
  "remove",
  "mechanism",
  "circuit_breaker",
  "cable_route",
] as const;
export type ElectricalIntent = (typeof ELECTRICAL_INTENTS)[number];

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

export function parseElectricalIntent(text: string): ElectricalIntent | null {
  const n = normalizeText(text);
  if (!ELECTRICAL_ANCHORS.some((a) => n.includes(a))) return null;
  const has = (kw: string) => textMatchesKeyword(n, kw);
  const any = (kws: string[]) => kws.some(has);

  if (has("automat") || has("disjunctor") || n.includes("автомат")) {
    return "circuit_breaker";
  }
  if (
    any(["mutare", "mutarea", "mutam", "muta", "mutat", "deplasare", "deplasam"]) ||
    n.includes("перенос") ||
    n.includes("перемещ")
  ) {
    return "relocate";
  }
  if (
    any(["demontare", "demontaj", "demontam", "demolare", "scoatere", "desfacere"]) ||
    n.includes("демонтаж") ||
    n.includes("снят")
  ) {
    return "remove";
  }

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
  const mentionsSocketOrPoint = any([
    "priza",
    "prize",
    "punct",
    "puncte",
    "doza",
    "doze",
  ]);
  const mentionsCable = has("cablu") || has("tras") || has("tragem");
  if (newPoint || (mentionsSocketOrPoint && mentionsCable)) return "new_point";

  if (
    has("pozare") ||
    has("cablu") ||
    has("traseu") ||
    (has("circuit") && n.includes("tablou"))
  ) {
    return "cable_route";
  }

  if (
    mentionsSocketOrPoint ||
    has("intrerupator") ||
    has("intrerupatoare") ||
    n.includes("выключател")
  ) {
    return "mechanism";
  }

  return null;
}

export function hasElectricalIntentConflict(
  itemIntent: ElectricalIntent | null,
  candidateText: string,
): boolean {
  if (itemIntent === null) return false;
  const candidate = parseElectricalIntent(candidateText);
  if (candidate === null) return false;
  return candidate !== itemIntent;
}
