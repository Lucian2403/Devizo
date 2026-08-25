import { SUPPORTED_LANGUAGES } from "@/domain/shared/types";

// Human-readable labels for the language codes, shown in dropdowns.
export const LANGUAGE_LABELS: Record<(typeof SUPPORTED_LANGUAGES)[number], string> =
  {
    ro: "Română",
    ru: "Русский",
    en: "English",
    it: "Italiano",
    fr: "Français",
    de: "Deutsch",
    es: "Español",
  };

export const LANGUAGE_OPTIONS = SUPPORTED_LANGUAGES.map((code) => ({
  value: code,
  label: LANGUAGE_LABELS[code],
}));
