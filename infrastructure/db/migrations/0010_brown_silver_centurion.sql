-- M7.1 Commercial currency integrity: give every catalog item an explicit
-- currency so its prices can never be silently reinterpreted when the
-- organization's default currency changes later.
--
-- LEGACY BACKFILL (inference, not historical proof): existing rows never
-- stored a currency. The best available inference is the owning organization's
-- CURRENT default_currency, because until now all catalog prices were assumed
-- to be in that currency. This is an inference — it does NOT convert any price
-- value; it only labels the existing numeric amounts with a currency code.
--
-- Order: add nullable -> backfill from org default -> enforce NOT NULL -> check.
ALTER TABLE "catalog_items" ADD COLUMN "currency" text;--> statement-breakpoint
UPDATE "catalog_items" AS ci
  SET "currency" = o."default_currency"
  FROM "organizations" AS o
  WHERE ci."organization_id" = o."id" AND ci."currency" IS NULL;--> statement-breakpoint
-- Safety net: any row still lacking an org default falls back to MDL so the
-- NOT NULL constraint below cannot fail. This should match zero rows in
-- practice because default_currency is itself NOT NULL.
UPDATE "catalog_items" SET "currency" = 'MDL' WHERE "currency" IS NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ALTER COLUMN "currency" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_currency_check" CHECK ("catalog_items"."currency" in ('MDL', 'EUR', 'RON', 'USD', 'GBP'));