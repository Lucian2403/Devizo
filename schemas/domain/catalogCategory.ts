import { z } from "zod";

export const catalogCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
});

export type CatalogCategoryValues = z.infer<typeof catalogCategorySchema>;
