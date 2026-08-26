import { z } from "zod";
import { PROJECT_STATUSES } from "@/domain/shared/types";
import { emptyToUndefined } from "@/schemas/shared";

export const projectSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(200),
  // A customer is optional; empty selection becomes undefined.
  customerId: z.preprocess(
    emptyToUndefined,
    z.string().uuid().optional(),
  ),
  address: z.string().trim().max(400).optional(),
  description: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(PROJECT_STATUSES).default("planned"),
});

export type ProjectValues = z.infer<typeof projectSchema>;
