CREATE TYPE "public"."alert_channel" AS ENUM('email', 'webhook', 'slack', 'discord');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('quota_warning', 'rate_limit_exceeded', 'api_key_expiring', 'error_rate_spike');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(32) NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"channel" "alert_channel" NOT NULL,
	"type" "alert_type" NOT NULL,
	"threshold" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"user_id" integer NOT NULL,
	"tenant_id" varchar(32) DEFAULT 'org_1' NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"scopes" varchar[],
	"rate_limit_override" jsonb,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"ip_allowlist" varchar[],
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_events" (
	"time" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"tenant_id" varchar(32) DEFAULT 'org_1' NOT NULL,
	"api_key_id" integer NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"method" varchar(10) DEFAULT 'GET' NOT NULL,
	"user_agent" text,
	"status_code" integer NOT NULL,
	"request_duration_ms" integer,
	"response_size" integer,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"remaining_quota" integer
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"quota" integer DEFAULT 1000 NOT NULL,
	"strategy" varchar(50) DEFAULT 'fixed_window' NOT NULL,
	"window_seconds" integer DEFAULT 60 NOT NULL,
	"stripe_customer_id" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"role" "user_role" DEFAULT 'admin' NOT NULL,
	"tenant_id" varchar(32) DEFAULT 'org_1' NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"url" varchar(500) NOT NULL,
	"secret" varchar(255),
	"events" varchar[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"headers" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_events" ADD CONSTRAINT "rate_limit_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_events" ADD CONSTRAINT "rate_limit_events_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_id_name_unique_idx" ON "api_keys" USING btree ("user_id","name");