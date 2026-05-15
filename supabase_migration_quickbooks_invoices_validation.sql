-- Run this in your Supabase SQL Editor.
-- Adds structured per-invoice ZATCA validation messages so the UI can show
-- exactly which rules failed (or warned) on each clearance attempt.

ALTER TABLE quickbooks_invoices
  ADD COLUMN IF NOT EXISTS zatca_validation_messages JSONB NOT NULL DEFAULT '[]'::jsonb;
