import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('orgId');
    const from = req.nextUrl.searchParams.get('from');
    const to = req.nextUrl.searchParams.get('to');

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('quickbooks_invoices')
      .select(
        'id, qb_invoice_id, qb_doc_number, invoice_date, customer_name, total_amount, currency, zatca_status, zatca_invoice_type, zatca_error, zatca_validation_messages, zatca_cleared_at'
      )
      .eq('organization_id', orgId)
      .order('invoice_date', { ascending: false, nullsFirst: false });

    if (from && ISO_DATE.test(from)) {
      query = query.gte('invoice_date', from);
    }
    if (to && ISO_DATE.test(to)) {
      query = query.lte('invoice_date', to);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ invoices: data ?? [] });
  } catch (e: any) {
    console.error('[QB-INVOICES-LIST]:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
