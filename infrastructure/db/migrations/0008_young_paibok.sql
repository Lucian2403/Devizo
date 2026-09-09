ALTER TABLE "quote_versions" ADD COLUMN "company_name" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "company_legal_name" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "company_tax_vat_id" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "company_email" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "company_phone" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "company_address" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "company_country" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "document_language" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "valid_until" timestamp with time zone;