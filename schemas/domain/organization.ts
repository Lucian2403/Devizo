import { z } from "zod";
import { currencySchema, languageSchema } from "@/schemas/shared";

const slug = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens only.");

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug,
  defaultCurrency: currencySchema.default("EUR"),
  defaultLanguage: languageSchema.default("ro"),
  customerDocumentLanguage: languageSchema.default("ro"),
});

export type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>;

// VAT rate is a percentage between 0 and 100. It arrives from the form as a
// string; we validate it as a number but keep money-related values as strings
// elsewhere. The rate itself is a simple bounded percentage here.
const vatRate = z.coerce
  .number()
  .min(0, "VAT rate cannot be below 0.")
  .max(100, "VAT rate cannot be above 100.");

const optionalText = z.string().trim().max(200).optional();

export const companySettingsSchema = z.object({
  name: z.string().min(2).max(120),
  legalName: optionalText,
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  phone: optionalText,
  address: z.string().trim().max(400).optional(),
  country: optionalText,
  vatNumber: optionalText,
  vatRate: vatRate.optional().or(z.literal("").transform(() => undefined)),
  defaultCurrency: currencySchema,
  defaultLanguage: languageSchema,
  customerDocumentLanguage: languageSchema,
});

export type CompanySettingsValues = z.infer<typeof companySettingsSchema>;
