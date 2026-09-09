ALTER TABLE "organizations" ADD COLUMN "payment_terms" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "execution_duration" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "inclusions" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "exclusions" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "legal_terms" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "payment_terms" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "execution_duration" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "inclusions" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "exclusions" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "company_terms" text;