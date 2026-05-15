import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('orgId');
    const month = req.nextUrl.searchParams.get('month');

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('quickbooks_invoices')
      .select(
        'id, qb_invoice_id, qb_doc_number, invoice_date, customer_name, total_amount, currency, zatca_status, zatca_error, zatca_cleared_at'
      )
      .eq('organization_id', orgId)
      .order('invoice_date', { ascending: false, nullsFirst: false });

    if (month) {
      const range = monthRange(month);
      if (range) {
        query = query.gte('invoice_date', range.start).lte('invoice_date', range.end);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ invoices: data ?? [] });
  } catch (e: any) {
    console.error('[QB-INVOICES-LIST]:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function monthRange(month: string): { start: string; end: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) return null;
  const start = `${m[1]}-${m[2]}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const end = `${m[1]}-${m[2]}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}
