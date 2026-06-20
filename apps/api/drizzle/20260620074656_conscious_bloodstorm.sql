CREATE TYPE "public"."ai_message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('hadir', 'izin', 'sakit', 'cuti', 'alpha');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'void', 'approve', 'reject', 'login', 'logout', 'export', 'import', 'verify', 'pick', 'send');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('pos_terminal', 'tablet', 'smartphone', 'printer', 'scanner');--> statement-breakpoint
CREATE TYPE "public"."incoming_good_status" AS ENUM('draft', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."leave_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."leave_type" AS ENUM('tahunan', 'sakit', 'penting', 'melahirkan', 'lainnya');--> statement-breakpoint
CREATE TYPE "public"."member_tier" AS ENUM('silver', 'gold', 'platinum');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'held', 'pending_payment', 'completed', 'voided', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."outgoing_good_status" AS ENUM('draft', 'picking', 'ready', 'sent', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('tunai', 'qris', 'debit');--> statement-breakpoint
CREATE TYPE "public"."printer_connection" AS ENUM('usb', 'network', 'bluetooth');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('aktif', 'stok_tipis', 'habis', 'nonaktif');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('aktif', 'selesai', 'ditutup_paksa');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('in_purchase', 'in_adjustment', 'in_return', 'out_sale', 'out_adjustment', 'out_damage', 'out_transfer');--> statement-breakpoint
CREATE TYPE "public"."surat_approval_action" AS ENUM('review', 'approve', 'reject');--> statement-breakpoint
CREATE TYPE "public"."surat_jalan_status" AS ENUM('draft', 'pending_review', 'pending_approval', 'approved', 'rejected', 'sent', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."telegram_event_type" AS ENUM('sj_pending_approval', 'sj_approved', 'sj_rejected', 'stock_kritis', 'barang_masuk_verified', 'laporan_harian_ready', 'shift_dimulai', 'shift_diakhiri', 'error_sistem');--> statement-breakpoint
CREATE TYPE "public"."telegram_message_direction" AS ENUM('incoming', 'outgoing');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('kasir', 'admin_gudang', 'manager', 'super_admin');--> statement-breakpoint
CREATE TABLE "pin_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"success" boolean NOT NULL,
	"ip_address" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" varchar(100) NOT NULL,
	"email" varchar(150),
	"phone" varchar(20),
	"role" "user_role" NOT NULL,
	"outlet_id" uuid,
	"pin_hash" text,
	"telegram_chat_id" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"icon_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_code" varchar(50) NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(150),
	"tier" "member_tier" DEFAULT 'silver' NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"total_spent" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_member_code_unique" UNIQUE("member_code")
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(50) NOT NULL,
	"barcode" varchar(50),
	"name" varchar(200) NOT NULL,
	"description" text,
	"category_id" uuid NOT NULL,
	"supplier_id" uuid,
	"outlet_id" uuid NOT NULL,
	"purchase_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"selling_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"stock_min" integer DEFAULT 0 NOT NULL,
	"stock_max" integer,
	"unit" varchar(20) DEFAULT 'pcs' NOT NULL,
	"status" "product_status" DEFAULT 'aktif' NOT NULL,
	"image_url" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"contact_person" varchar(100),
	"phone" varchar(20),
	"email" varchar(150),
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"old_quantity" integer NOT NULL,
	"new_quantity" integer NOT NULL,
	"difference" integer NOT NULL,
	"reason" text NOT NULL,
	"adjusted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"quantity" integer NOT NULL,
	"reference_type" varchar(50),
	"reference_id" uuid,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stocks_product_outlet_uq" UNIQUE("product_id","outlet_id")
);
--> statement-breakpoint
CREATE TABLE "held_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cashier_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"draft_name" varchar(100),
	"draft_data" jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" varchar(200) NOT NULL,
	"product_sku" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"discount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"subtotal" numeric(15, 2) NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"outlet_id" uuid NOT NULL,
	"shift_id" uuid,
	"cashier_id" uuid NOT NULL,
	"member_id" uuid,
	"status" "order_status" DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(15, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"paid" numeric(15, 2) DEFAULT '0' NOT NULL,
	"change" numeric(15, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"idempotency_key" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"reference" varchar(100),
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cashier_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_handovers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_shift_id" uuid NOT NULL,
	"to_cashier_id" uuid NOT NULL,
	"handover_notes" text,
	"cash_transferred" numeric(15, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_code" varchar(50) NOT NULL,
	"outlet_id" uuid NOT NULL,
	"cashier_id" uuid NOT NULL,
	"cashier_name" varchar(100) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"starting_cash" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ending_cash" numeric(15, 2),
	"expected_cash" numeric(15, 2),
	"cash_difference" numeric(15, 2),
	"total_transactions" integer DEFAULT 0 NOT NULL,
	"total_sales" numeric(15, 2) DEFAULT '0' NOT NULL,
	"status" "shift_status" DEFAULT 'aktif' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shifts_shift_code_unique" UNIQUE("shift_code")
);
--> statement-breakpoint
CREATE TABLE "incoming_good_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incoming_good_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" varchar(200) NOT NULL,
	"product_sku" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"purchase_price" numeric(15, 2) NOT NULL,
	"subtotal" numeric(15, 2) NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "incoming_goods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_number" varchar(50) NOT NULL,
	"outlet_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"supplier_name" varchar(150) NOT NULL,
	"received_date" timestamp with time zone DEFAULT now() NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"status" "incoming_good_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"rejected_by" uuid,
	"rejected_at" timestamp with time zone,
	"reject_reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incoming_goods_document_number_unique" UNIQUE("document_number")
);
--> statement-breakpoint
CREATE TABLE "outgoing_good_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outgoing_good_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" varchar(200) NOT NULL,
	"product_sku" varchar(50) NOT NULL,
	"quantity_picked" integer DEFAULT 0 NOT NULL,
	"quantity_sent" integer DEFAULT 0 NOT NULL,
	"picked_by" uuid,
	"picked_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "outgoing_goods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_number" varchar(50) NOT NULL,
	"outlet_id" uuid NOT NULL,
	"destination" varchar(200) NOT NULL,
	"reference_type" varchar(50),
	"reference_id" uuid,
	"total_items" integer DEFAULT 0 NOT NULL,
	"status" "outgoing_good_status" DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outgoing_goods_document_number_unique" UNIQUE("document_number")
);
--> statement-breakpoint
CREATE TABLE "surat_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"surat_id" uuid NOT NULL,
	"approver_id" uuid NOT NULL,
	"action" "surat_approval_action" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surat_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"surat_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" varchar(200) NOT NULL,
	"product_sku" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "surats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_number" varchar(50) NOT NULL,
	"outlet_id" uuid NOT NULL,
	"outgoing_good_id" uuid,
	"order_id" uuid,
	"destination" varchar(200) NOT NULL,
	"recipient_name" varchar(150) NOT NULL,
	"recipient_phone" varchar(20),
	"total_items" integer DEFAULT 0 NOT NULL,
	"status" "surat_jalan_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"rejected_by" uuid,
	"rejected_at" timestamp with time zone,
	"reject_reason" text,
	"pdf_url" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "surats_document_number_unique" UNIQUE("document_number")
);
--> statement-breakpoint
CREATE TABLE "attendances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"shift_id" uuid,
	"check_in_at" timestamp with time zone NOT NULL,
	"check_out_at" timestamp with time zone,
	"status" "attendance_status" DEFAULT 'hadir' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_performances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_transactions" integer DEFAULT 0 NOT NULL,
	"total_sales" numeric(15, 2) DEFAULT '0' NOT NULL,
	"attendance_score" numeric(5, 2),
	"performance_score" numeric(5, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"outlet_id" uuid NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"nik" varchar(30),
	"phone" varchar(20),
	"email" varchar(150),
	"position" varchar(100),
	"join_date" date NOT NULL,
	"resign_date" date,
	"base_salary" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type" "leave_type" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"total_days" integer NOT NULL,
	"reason" text NOT NULL,
	"status" "leave_request_status" DEFAULT 'pending' NOT NULL,
	"approver_id" uuid,
	"approved_at" timestamp with time zone,
	"reject_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"report_date" date NOT NULL,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"total_sales" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_items_sold" integer DEFAULT 0 NOT NULL,
	"total_void" integer DEFAULT 0 NOT NULL,
	"total_void_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_discount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_tax" numeric(15, 2) DEFAULT '0' NOT NULL,
	"payment_breakdown" jsonb,
	"top_products" jsonb,
	"cashier_breakdown" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"snapshot_type" varchar(50) NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "telegram_event_type" NOT NULL,
	"target_user_id" uuid,
	"target_chat_id" varchar(50),
	"payload" jsonb NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"telegram_chat_id" varchar(50),
	"telegram_username" varchar(100),
	"link_code" varchar(20) NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "telegram_links_link_code_unique" UNIQUE("link_code")
);
--> statement-breakpoint
CREATE TABLE "telegram_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_link_id" uuid NOT NULL,
	"message_text" text NOT NULL,
	"direction" "telegram_message_direction" NOT NULL,
	"status" varchar(20) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"outlet_id" uuid,
	"title" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "ai_message_role" NOT NULL,
	"content" text NOT NULL,
	"tokens_used" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"outlet_id" uuid,
	"action" "audit_action" NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"old_data" jsonb,
	"new_data" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"device_name" varchar(100) NOT NULL,
	"device_type" "device_type" NOT NULL,
	"mac_address" text,
	"ip_address" text,
	"last_seen_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlet_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"address" text,
	"phone" varchar(20),
	"email" varchar(150),
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(10) DEFAULT 'IDR' NOT NULL,
	"receipt_header" text,
	"receipt_footer" text,
	"open_time" varchar(5),
	"close_time" varchar(5),
	"timezone" varchar(50) DEFAULT 'Asia/Jakarta' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outlet_settings_outlet_id_unique" UNIQUE("outlet_id")
);
--> statement-breakpoint
CREATE TABLE "printers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"connection_type" "printer_connection" NOT NULL,
	"address" varchar(200) NOT NULL,
	"paper_width" integer DEFAULT 80 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "pin_attempts" ADD CONSTRAINT "pin_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "held_drafts" ADD CONSTRAINT "held_drafts_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_handovers" ADD CONSTRAINT "shift_handovers_from_shift_id_shifts_id_fk" FOREIGN KEY ("from_shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_handovers" ADD CONSTRAINT "shift_handovers_to_cashier_id_users_id_fk" FOREIGN KEY ("to_cashier_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_good_items" ADD CONSTRAINT "incoming_good_items_incoming_good_id_incoming_goods_id_fk" FOREIGN KEY ("incoming_good_id") REFERENCES "public"."incoming_goods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_goods" ADD CONSTRAINT "incoming_goods_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_goods" ADD CONSTRAINT "incoming_goods_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_goods" ADD CONSTRAINT "incoming_goods_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_goods" ADD CONSTRAINT "incoming_goods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outgoing_good_items" ADD CONSTRAINT "outgoing_good_items_outgoing_good_id_outgoing_goods_id_fk" FOREIGN KEY ("outgoing_good_id") REFERENCES "public"."outgoing_goods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outgoing_good_items" ADD CONSTRAINT "outgoing_good_items_picked_by_users_id_fk" FOREIGN KEY ("picked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outgoing_goods" ADD CONSTRAINT "outgoing_goods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surat_approvals" ADD CONSTRAINT "surat_approvals_surat_id_surats_id_fk" FOREIGN KEY ("surat_id") REFERENCES "public"."surats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surat_approvals" ADD CONSTRAINT "surat_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surat_items" ADD CONSTRAINT "surat_items_surat_id_surats_id_fk" FOREIGN KEY ("surat_id") REFERENCES "public"."surats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surats" ADD CONSTRAINT "surats_outgoing_good_id_outgoing_goods_id_fk" FOREIGN KEY ("outgoing_good_id") REFERENCES "public"."outgoing_goods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surats" ADD CONSTRAINT "surats_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surats" ADD CONSTRAINT "surats_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surats" ADD CONSTRAINT "surats_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surats" ADD CONSTRAINT "surats_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_performances" ADD CONSTRAINT "employee_performances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_messages" ADD CONSTRAINT "telegram_messages_telegram_link_id_telegram_links_id_fk" FOREIGN KEY ("telegram_link_id") REFERENCES "public"."telegram_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pin_attempts_user_idx" ON "pin_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pin_attempts_time_idx" ON "pin_attempts" USING btree ("attempted_at");--> statement-breakpoint
CREATE INDEX "user_sessions_user_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_outlet_idx" ON "users" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "users_active_idx" ON "users" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "categories_outlet_idx" ON "categories" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "categories_active_idx" ON "categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "members_code_idx" ON "members" USING btree ("member_code");--> statement-breakpoint
CREATE INDEX "members_phone_idx" ON "members" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "members_outlet_idx" ON "members" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "members_tier_idx" ON "members" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_sku_idx" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "products_barcode_idx" ON "products" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_outlet_idx" ON "products" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_name_idx" ON "products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "suppliers_active_idx" ON "suppliers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "stock_adjustments_product_idx" ON "stock_adjustments" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_outlet_idx" ON "stock_adjustments" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_time_idx" ON "stock_adjustments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_product_idx" ON "stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_movements_outlet_idx" ON "stock_movements" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "stock_movements_type_idx" ON "stock_movements" USING btree ("type");--> statement-breakpoint
CREATE INDEX "stock_movements_ref_idx" ON "stock_movements" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "stock_movements_time_idx" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stocks_outlet_idx" ON "stocks" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "held_drafts_cashier_idx" ON "held_drafts" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "held_drafts_expires_idx" ON "held_drafts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orders_outlet_idx" ON "orders" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "orders_cashier_idx" ON "orders" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "orders_shift_idx" ON "orders" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "orders_member_idx" ON "orders" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_time_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_idemp_idx" ON "orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_method_idx" ON "payments" USING btree ("method");--> statement-breakpoint
CREATE INDEX "payments_time_idx" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "shift_handovers_from_idx" ON "shift_handovers" USING btree ("from_shift_id");--> statement-breakpoint
CREATE INDEX "shift_handovers_to_idx" ON "shift_handovers" USING btree ("to_cashier_id");--> statement-breakpoint
CREATE INDEX "shifts_cashier_idx" ON "shifts" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "shifts_outlet_idx" ON "shifts" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "shifts_status_idx" ON "shifts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shifts_started_idx" ON "shifts" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "incoming_good_items_incoming_idx" ON "incoming_good_items" USING btree ("incoming_good_id");--> statement-breakpoint
CREATE INDEX "incoming_good_items_product_idx" ON "incoming_good_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "incoming_goods_outlet_idx" ON "incoming_goods" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "incoming_goods_supplier_idx" ON "incoming_goods" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "incoming_goods_status_idx" ON "incoming_goods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "incoming_goods_date_idx" ON "incoming_goods" USING btree ("received_date");--> statement-breakpoint
CREATE INDEX "outgoing_good_items_outgoing_idx" ON "outgoing_good_items" USING btree ("outgoing_good_id");--> statement-breakpoint
CREATE INDEX "outgoing_good_items_product_idx" ON "outgoing_good_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "outgoing_goods_outlet_idx" ON "outgoing_goods" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "outgoing_goods_status_idx" ON "outgoing_goods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outgoing_goods_ref_idx" ON "outgoing_goods" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "surat_approvals_surat_idx" ON "surat_approvals" USING btree ("surat_id");--> statement-breakpoint
CREATE INDEX "surat_approvals_approver_idx" ON "surat_approvals" USING btree ("approver_id");--> statement-breakpoint
CREATE INDEX "surat_items_surat_idx" ON "surat_items" USING btree ("surat_id");--> statement-breakpoint
CREATE INDEX "surat_items_product_idx" ON "surat_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "surats_outlet_idx" ON "surats" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "surats_status_idx" ON "surats" USING btree ("status");--> statement-breakpoint
CREATE INDEX "surats_outgoing_idx" ON "surats" USING btree ("outgoing_good_id");--> statement-breakpoint
CREATE INDEX "attendances_employee_idx" ON "attendances" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "attendances_outlet_idx" ON "attendances" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "attendances_date_idx" ON "attendances" USING btree ("check_in_at");--> statement-breakpoint
CREATE INDEX "employee_performances_employee_idx" ON "employee_performances" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_performances_period_idx" ON "employee_performances" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "employees_outlet_idx" ON "employees" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "employees_user_idx" ON "employees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "employees_active_idx" ON "employees" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "leave_requests_employee_idx" ON "leave_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "leave_requests_status_idx" ON "leave_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "daily_reports_outlet_idx" ON "daily_reports" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "daily_reports_date_idx" ON "daily_reports" USING btree ("report_date");--> statement-breakpoint
CREATE INDEX "report_snapshots_outlet_idx" ON "report_snapshots" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "report_snapshots_type_idx" ON "report_snapshots" USING btree ("snapshot_type");--> statement-breakpoint
CREATE INDEX "report_snapshots_valid_idx" ON "report_snapshots" USING btree ("valid_from");--> statement-breakpoint
CREATE INDEX "notification_queue_event_idx" ON "notification_queue" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "notification_queue_status_idx" ON "notification_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notification_queue_next_idx" ON "notification_queue" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_queue_target_idx" ON "notification_queue" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "telegram_links_user_idx" ON "telegram_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "telegram_links_code_idx" ON "telegram_links" USING btree ("link_code");--> statement-breakpoint
CREATE INDEX "telegram_links_verified_idx" ON "telegram_links" USING btree ("is_verified");--> statement-breakpoint
CREATE INDEX "telegram_messages_link_idx" ON "telegram_messages" USING btree ("telegram_link_id");--> statement-breakpoint
CREATE INDEX "telegram_messages_direction_idx" ON "telegram_messages" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "ai_conversations_user_idx" ON "ai_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_conversations_time_idx" ON "ai_conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "ai_messages_conversation_idx" ON "ai_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_time_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "devices_outlet_idx" ON "devices" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "devices_type_idx" ON "devices" USING btree ("device_type");--> statement-breakpoint
CREATE INDEX "outlet_settings_active_idx" ON "outlet_settings" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "printers_outlet_idx" ON "printers" USING btree ("outlet_id");--> statement-breakpoint
CREATE INDEX "printers_default_idx" ON "printers" USING btree ("is_default");