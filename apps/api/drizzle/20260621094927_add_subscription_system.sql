CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('active', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan_code" AS ENUM('trial', 'starter', 'basic', 'standard', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trial', 'active', 'past_due', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"code" varchar(50) NOT NULL,
	"email" varchar(150),
	"phone" varchar(20),
	"address" text,
	"business_type" varchar(50),
	"status" "organization_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "outlet_users" (
	"outlet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outlet_users_outlet_id_user_id_pk" PRIMARY KEY("outlet_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"code" varchar(50) NOT NULL,
	"address" text,
	"phone" varchar(20),
	"parent_outlet_id" uuid,
	"status" "organization_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outlets_org_code_unique" UNIQUE("organization_id","code")
);
--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"amount_idr" integer NOT NULL,
	"payment_method" varchar(50),
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"midtrans_transaction_id" varchar(100),
	"midtrans_payment_type" varchar(50),
	"midtrans_response" jsonb,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"manual_reference" text,
	"manual_notes" text,
	"paid_at" timestamp with time zone,
	"verified_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"code" "subscription_plan_code" PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"max_outlets" integer,
	"max_users_per_outlet" integer,
	"max_products" integer,
	"max_transactions_per_month" integer,
	"max_storage_mb" integer,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_monthly_idr" integer DEFAULT 0 NOT NULL,
	"price_yearly_idr" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_code" "subscription_plan_code" NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"billing_cycle" "billing_cycle" DEFAULT 'monthly' NOT NULL,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"custom_max_outlets" integer,
	"custom_max_users" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_users" ADD CONSTRAINT "outlet_users_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_users" ADD CONSTRAINT "outlet_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_code_subscription_plans_code_fk" FOREIGN KEY ("plan_code") REFERENCES "public"."subscription_plans"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organizations_code_idx" ON "organizations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "organizations_status_idx" ON "organizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outlet_users_user_idx" ON "outlet_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "outlet_users_primary_idx" ON "outlet_users" USING btree ("user_id","is_primary");--> statement-breakpoint
CREATE INDEX "outlets_org_idx" ON "outlets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "outlets_status_idx" ON "outlets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscription_payments_sub_idx" ON "subscription_payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_payments_org_idx" ON "subscription_payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "subscription_payments_status_idx" ON "subscription_payments" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "subscription_payments_midtrans_idx" ON "subscription_payments" USING btree ("midtrans_transaction_id");--> statement-breakpoint
CREATE INDEX "subscription_plans_active_idx" ON "subscription_plans" USING btree ("is_active","is_public");--> statement-breakpoint
CREATE INDEX "subscription_plans_sort_idx" ON "subscription_plans" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "subscriptions_org_idx" ON "subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_period_end_idx" ON "subscriptions" USING btree ("current_period_end");