import { z } from "zod";

const slug = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens only.");

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug,
  defaultCurrency: z.string().length(3).default("EUR"),
  defaultLanguage: z.string().min(2).max(8).default("en"),
  customerDocumentLanguage: z.string().min(2).max(8).default("en"),
});

export type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>;
