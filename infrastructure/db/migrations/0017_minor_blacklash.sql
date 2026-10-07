ALTER TABLE "normative_applicability_decisions" DROP CONSTRAINT "normative_applicability_decider_org_fkey";
--> statement-breakpoint
ALTER TABLE "normative_source_relations" DROP CONSTRAINT "normative_source_relations_creator_org_fkey";
--> statement-breakpoint
ALTER TABLE "normative_update_reviews" DROP CONSTRAINT "normative_update_reviews_reviewer_org_fkey";
--> statement-breakpoint
ALTER TABLE "normative_applicability_decisions" ADD COLUMN "source_title" text;--> statement-breakpoint
ALTER TABLE "normative_applicability_decisions" ADD COLUMN "source_publisher" text;--> statement-breakpoint
ALTER TABLE "normative_applicability_decisions" ADD COLUMN "source_jurisdiction" text;