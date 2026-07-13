ALTER TABLE "users" DROP CONSTRAINT "users_google_id_unique";--> statement-breakpoint
ALTER TABLE "alerts" ALTER COLUMN "channel" SET DATA TYPE "public"."alert_channel";--> statement-breakpoint
ALTER TABLE "alerts" ALTER COLUMN "type" SET DATA TYPE "public"."alert_type";--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "tenant_id" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "tenant_id" SET DEFAULT 'org_1';--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limit_events" ALTER COLUMN "tenant_id" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "rate_limit_events" ALTER COLUMN "tenant_id" SET DEFAULT 'org_1';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "tenant_id" varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_events" ADD CONSTRAINT "rate_limit_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "google_id";--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_name_unique" UNIQUE("name");--> statement-breakpoint
DROP TYPE "public"."alert_channel";--> statement-breakpoint
DROP TYPE "public"."user_role";