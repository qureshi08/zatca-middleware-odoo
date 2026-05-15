-- Run this in your Supabase SQL Editor.
-- Creates the local mirror of QuickBooks invoices + their ZATCA clearance state.

CREATE TABLE IF NOT EXISTS quickbooks_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,

  -- QuickBooks identity
  qb_invoice_id TEXT NOT NULL,
  qb_doc_number TEXT,
  invoice_date DATE,
  customer_id TEXT,
  customer_name TEXT,
  total_amount NUMERIC(18, 2),
  currency TEXT,
  raw_qb_payload JSONB NOT NULL,

  -- ZATCA clearance state
  zatca_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (zatca_status IN ('pending', 'submitted', 'cleared', 'failed')),
  zatca_cleared_xml TEXT,
  zatca_qr TEXT,
  zatca_error TEXT,
  zatca_submitted_at TIMESTAMPTZ,
  zatca_cleared_at TIMESTAMPTZ,

  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Re-importing the same QB invoice updates the existing row instead of duplicating
  UNIQUE (organization_id, qb_invoice_id)
);

-- Month filter on the table view sorts by date desc within an org
CREATE INDEX IF NOT EXISTS idx_qbi_org_date
  ON quickbooks_invoices (organization_id, invoice_date DESC);

-- Used when the import upsert needs to preserve already-cleared rows
CREATE INDEX IF NOT EXISTS idx_qbi_org_status
  ON quickbooks_invoices (organization_id, zatca_status);
