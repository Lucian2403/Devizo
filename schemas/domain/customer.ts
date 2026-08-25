import { z } from "zod";
import { languageSchema } from "@/schemas/shared";

// Optional email that also accepts an empty string (turned into undefined).
const optionalEmail = z
  .string()
  .email()
  .optional()
  .or(z.literal("").transform(() => undefined));

export const customerSchema = z.object({
  name: z.string().min(2, "Name is required.").max(160),
  contactName: z.string().trim().max(160).optional(),
  email: optionalEmail,
  phone: z.string().trim().max(60).optional(),
  preferredLanguage: languageSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type CustomerValues = z.infer<typeof customerSchema>;
