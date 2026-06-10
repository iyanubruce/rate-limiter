ALTER TABLE "rate_limit_rules" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "rate_limit_rules" CASCADE;--> statement-breakpoint
ALTER TABLE "rate_limit_events" DROP CONSTRAINT "rate_limit_events_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "rate_limit_events" DROP CONSTRAINT "rate_limit_events_rule_id_rate_limit_rules_id_fk";
--> statement-breakpoint
ALTER TABLE "rate_limit_events" DROP CONSTRAINT "rate_limit_events_time_id_pk";--> statement-breakpoint
ALTER TABLE "rate_limit_events" ALTER COLUMN "method" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "rate_limit_events" ALTER COLUMN "method" SET DEFAULT 'GET';--> statement-breakpoint
ALTER TABLE "rate_limit_events" ALTER COLUMN "user_agent" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "rate_limit_events" ALTER COLUMN "api_key_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "id" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "strategy" SET DEFAULT 'fixed_window';--> statement-breakpoint
ALTER TABLE "rate_limit_events" ADD COLUMN "tenant_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tenant_id" varchar(32) DEFAULT 'org_1' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_events" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "rate_limit_events" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "rate_limit_events" DROP COLUMN "rule_id";--> statement-breakpoint
ALTER TABLE "rate_limit_events" DROP COLUMN "block_reason";--> statement-breakpoint
ALTER TABLE "rate_limit_events" DROP COLUMN "request_id";--> statement-breakpoint
ALTER TABLE "rate_limit_events" DROP COLUMN "country";--> statement-breakpoint
ALTER TABLE "rate_limit_events" DROP COLUMN "device_fingerprint";--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_email_unique" UNIQUE("email");