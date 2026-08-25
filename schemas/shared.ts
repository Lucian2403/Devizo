import { z } from "zod";
import { SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES } from "@/domain/shared/types";

// A language field must be one of the supported MVP languages.
export const languageSchema = z.enum(SUPPORTED_LANGUAGES);

// A currency field must be one of the supported MVP currencies.
export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

// Turns an empty string from a form into undefined, otherwise keeps the value.
export function emptyToUndefined(value: unknown): unknown {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}
