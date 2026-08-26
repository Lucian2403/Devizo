import { SUPPORTED_UNITS } from "@/domain/shared/types";

// Short human labels for the canonical units, shown in dropdowns and lists.
export const UNIT_LABELS: Record<(typeof SUPPORTED_UNITS)[number], string> = {
  m2: "m² (metru pătrat)",
  m: "m (metru)",
  m3: "m³ (metru cub)",
  pcs: "buc (bucată)",
  hour: "oră",
  day: "zi",
  kg: "kg",
  l: "l (litru)",
  set: "set",
  service: "serviciu",
};

export const UNIT_OPTIONS = SUPPORTED_UNITS.map((code) => ({
  value: code,
  label: UNIT_LABELS[code],
}));
