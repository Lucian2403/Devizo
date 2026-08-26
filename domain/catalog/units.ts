import { SUPPORTED_UNITS, type SupportedUnit } from "@/domain/shared/types";

// Built-in aliases mapping common spreadsheet unit spellings (RO/RU/IT/etc.)
// to canonical units. During import the user can override any mapping, but we
// pre-fill from this table. Keys are compared lowercased and trimmed.
const UNIT_ALIASES: Record<string, SupportedUnit> = {
  // square meters
  "m2": "m2",
  "m²": "m2",
  "mp": "m2",
  "sqm": "m2",
  // linear meters
  "m": "m",
  "ml": "m",
  "lm": "m",
  // cubic meters
  "m3": "m3",
  "m³": "m3",
  "mc": "m3",
  // pieces
  "pcs": "pcs",
  "pc": "pcs",
  "buc": "pcs",
  "buc.": "pcs",
  "bucata": "pcs",
  "bucată": "pcs",
  "unit": "pcs",
  "шт": "pcs",
  // hour
  "hour": "hour",
  "hr": "hour",
  "h": "hour",
  "ora": "hour",
  "oră": "hour",
  "ore": "hour",
  "час": "hour",
  // day
  "day": "day",
  "zi": "day",
  "zile": "day",
  "день": "day",
  // kilogram
  "kg": "kg",
  "kilo": "kg",
  "кг": "kg",
  // liter
  "l": "l",
  "lt": "l",
  "litru": "l",
  "л": "l",
  // set
  "set": "set",
  "kit": "set",
  // service
  "service": "service",
  "serviciu": "service",
  "servicii": "service",
};

// Best-effort canonical unit for a raw imported value, or null if unknown.
// A null result means the user must map it explicitly before importing.
export function suggestUnit(raw: string): SupportedUnit | null {
  const key = raw.trim().toLowerCase();
  return UNIT_ALIASES[key] ?? null;
}

export function isSupportedUnit(value: string): value is SupportedUnit {
  return (SUPPORTED_UNITS as readonly string[]).includes(value);
}
