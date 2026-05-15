import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { mapQBInvoiceToZatca } from '@/lib/quickbooks/mapper';
import { generateInvoiceAction } from '@/lib/zatca/actions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ValidationMessage {
  code: string;
  category?: string;
  message: string;
  status?: 'ERROR' | 'WARNING';
}

interface ClearResult {
  id: string;
  qb_invoice_id: string;
  status: 'cleared' | 'failed' | 'skipped';
  error?: string;
  validationMessages?: ValidationMessage[];
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, invoiceIds, force } = await req.json();

    if (!orgId || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json(
        { error: 'orgId and a non-empty invoiceIds array are required' },
        { status: 400 }
      );
    }

    const { data: rows, error: fetchErr } = await supabaseAdmin
      .from('quickbooks_invoices')
      .select('id, qb_invoice_id, raw_qb_payload, zatca_status, zatca_invoice_type')
      .eq('organization_id', orgId)
      .in('id', invoiceIds);

    if (fetchErr) throw fetchErr;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'No matching invoices found' }, { status: 404 });
    }

    const results: ClearResult[] = [];

    for (const row of rows) {
      if (row.zatca_status === 'cleared' && !force) {
        results.push({
          id: row.id,
          qb_invoice_id: row.qb_invoice_id,
          status: 'skipped',
          error: 'Already cleared. Pass force=true to resubmit.',
        });
        continue;
      }

      await supabaseAdmin
        .from('quickbooks_invoices')
        .update({
          zatca_status: 'submitted',
          zatca_submitted_at: new Date().toISOString(),
          zatca_error: null,
          zatca_validation_messages: [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      let validationMessages: ValidationMessage[] = [];
      try {
        const invoiceType: 'standard' | 'simplified' =
          row.zatca_invoice_type === 'simplified' ? 'simplified' : 'standard';
        const zatcaInput = mapQBInvoiceToZatca(row.raw_qb_payload, invoiceType);
        const result: any = await generateInvoiceAction(zatcaInput, orgId);

        // Capture validation messages from both success (warnings) and
        // failure (errors) paths so the row can show them either way.
        validationMessages =
          result?.validationMessages ??
          result?.data?.validationMessages ??
          [];

        if (!result.success || !result.data) {
          throw new Error(result.error || 'Unknown ZATCA failure');
        }

        await supabaseAdmin
          .from('quickbooks_invoices')
          .update({
            zatca_status: 'cleared',
            zatca_cleared_xml: result.data.xml,
            zatca_qr: result.data.qrCode,
            zatca_error: null,
            zatca_validation_messages: validationMessages,
            zatca_cleared_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);

        results.push({
          id: row.id,
          qb_invoice_id: row.qb_invoice_id,
          status: 'cleared',
          validationMessages,
        });
      } catch (e: any) {
        const errMsg = e.message || String(e);
        // If we have structured validation messages, append a one-line
        // summary to the human-readable error so the table row shows
        // something more useful than "1 rule(s) failed".
        const summary =
          validationMessages.length > 0
            ? validationMessages
                .filter((m) => m.status !== 'WARNING')
                .map((m) => `${m.code}: ${m.message}`)
                .join(' | ')
            : '';
        const fullErr = summary ? `${errMsg} — ${summary}` : errMsg;

        await supabaseAdmin
          .from('quickbooks_invoices')
          .update({
            zatca_status: 'failed',
            zatca_error: fullErr,
            zatca_validation_messages: validationMessages,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);

        results.push({
          id: row.id,
          qb_invoice_id: row.qb_invoice_id,
          status: 'failed',
          error: fullErr,
          validationMessages,
        });
      }
    }

    const summary = results.reduce(
      (acc, r) => {
        acc[r.status]++;
        return acc;
      },
      { cleared: 0, failed: 0, skipped: 0 } as Record<string, number>
    );

    return NextResponse.json({ success: true, results, summary });
  } catch (e: any) {
    console.error('[QB-CLEAR]:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
