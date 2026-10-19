ALTER TABLE "calculation_contexts" ADD COLUMN "estimate_perspective" text;--> statement-breakpoint
ALTER TABLE "calculation_contexts" ADD COLUMN "work_kind" text;--> statement-breakpoint
ALTER TABLE "professional_resources" ADD COLUMN "procurement_category" text;--> statement-breakpoint
ALTER TABLE "resource_prices" ADD COLUMN "vat_treatment" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_prices" ADD COLUMN "transport_treatment" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "calculation_contexts" ADD CONSTRAINT "calculation_contexts_perspective_check" CHECK ("calculation_contexts"."estimate_perspective" is null or "calculation_contexts"."estimate_perspective" in ('investor', 'contractor'));--> statement-breakpoint
ALTER TABLE "calculation_contexts" ADD CONSTRAINT "calculation_contexts_work_kind_check" CHECK ("calculation_contexts"."work_kind" is null or "calculation_contexts"."work_kind" in ('construction', 'installation', 'commissioning'));--> statement-breakpoint
ALTER TABLE "professional_resources" ADD CONSTRAINT "professional_resources_procurement_category_check" CHECK ("professional_resources"."procurement_category" is null or "professional_resources"."procurement_category" in ('construction_materials', 'metal_structures', 'equipment', 'other'));--> statement-breakpoint
ALTER TABLE "resource_prices" ADD CONSTRAINT "resource_prices_vat_treatment_check" CHECK ("resource_prices"."vat_treatment" in ('exclusive', 'inclusive', 'unknown'));--> statement-breakpoint
ALTER TABLE "resource_prices" ADD CONSTRAINT "resource_prices_transport_treatment_check" CHECK ("resource_prices"."transport_treatment" in ('excluded', 'included', 'unknown'));