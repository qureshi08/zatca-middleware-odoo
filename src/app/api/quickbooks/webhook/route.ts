import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/quickbooks/webhook';
import { fetchInvoiceFromQuickbooks } from '@/lib/quickbooks/fetch';
import { mapQBInvoiceToZatca } from '@/lib/quickbooks/mapper';
import { generateInvoiceAction } from '@/lib/zatca/actions';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('intuit-signature') ?? '';

  // 1. Get QuickBooks Global Secret (for all webhooks)
  const clientSecret = process.env.QB_CLIENT_SECRET || '';

  const isValid = await verifyWebhookSignature(rawBody, signature, clientSecret);
  if (!isValid && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const notifications = payload.eventNotifications ?? [];

  for (const n of notifications) {
    const realmId = n.realmId;
    const invoiceId = n.data?.entities?.find((e: any) => e.name === 'Invoice')?.id;
    if (!invoiceId) continue;

    try {
      // 2. Map realmId to an Organization in our DB
      const { data: config } = await supabaseAdmin
        .from('quickbooks_config')
        .select('organization_id')
        .eq('realm_id', realmId)
        .maybeSingle();

      if (!config) {
          console.error(`[QB-WEBHOOK] Unknown Realm ID: ${realmId}`);
          continue;
      }

      // 3. Fetch and Process Invoice
      const qboInvoice = await fetchInvoiceFromQuickbooks(config.organization_id, realmId, invoiceId);
      const zatcaInvoice = mapQBInvoiceToZatca(qboInvoice);
      
      // 4. Submit directly to ZATCA engine
      await generateInvoiceAction(zatcaInvoice, config.organization_id);
      
    } catch (e: any) {
      console.error('[QB-WEBHOOK-FATAL]:', e.message);
    }
  }

  return NextResponse.json({ received: true });
}
