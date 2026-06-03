CREATE TYPE "public"."alert_channel" AS ENUM('email', 'webhook', 'slack', 'discord');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"channel" varchar(50) NOT NULL,
	"type" varchar(100) NOT NULL,
	"threshold" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"user_id" integer NOT NULL,
	"tenant_id" integer,
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
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_events" (
	"id" serial NOT NULL,
	"time" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"method" varchar(15) DEFAULT 'GET' NOT NULL,
	"user_agent" varchar(500),
	"status_code" integer NOT NULL,
	"request_duration_ms" integer,
	"response_size" integer,
	"user_id" integer,
	"api_key_id" integer,
	"rule_id" integer,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"remaining_quota" integer,
	"block_reason" varchar(255),
	"request_id" varchar(100),
	"country" varchar(2),
	"device_fingerprint" varchar(64),
	CONSTRAINT "rate_limit_events_time_id_pk" PRIMARY KEY("time","id")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"strategy" varchar(50) NOT NULL,
	"limit" integer NOT NULL,
	"window_ms" integer NOT NULL,
	"endpoint" varchar(500),
	"ip_whitelist" text,
	"is_active" boolean DEFAULT true,
	"burst_allowance" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"quota" integer DEFAULT 1000 NOT NULL,
	"strategy" varchar(50) DEFAULT 'token_bucket' NOT NULL,
	"window_seconds" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_events" ADD CONSTRAINT "rate_limit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_events" ADD CONSTRAINT "rate_limit_events_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_events" ADD CONSTRAINT "rate_limit_events_rule_id_rate_limit_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rate_limit_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_rules" ADD CONSTRAINT "rate_limit_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;