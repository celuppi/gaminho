CREATE TYPE "public"."card_criticality" AS ENUM('Urgente', 'Importante', 'Média', 'Baixa');--> statement-breakpoint
ALTER TYPE "public"."card_activity_type" ADD VALUE 'card.updated.criticality';--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "criticality" "card_criticality" DEFAULT 'Média' NOT NULL;