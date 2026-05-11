-- Migration: Add manual recipients to email_campaigns
ALTER TABLE "public"."email_campaigns" 
ADD COLUMN IF NOT EXISTS "manual_recipients" text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN "public"."email_campaigns"."manual_recipients" IS 'E-mails extras adicionados manualmente além do segmento';
