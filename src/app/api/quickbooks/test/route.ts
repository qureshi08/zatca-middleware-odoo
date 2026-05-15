import { NextRequest, NextResponse } from 'next/server';
import { QBO_API_BASE } from '@/lib/quickbooks/fetch';

export async function POST(req: NextRequest) {
  try {
    const { accessToken, realmId } = await req.json();

    if (!accessToken || !realmId) {
      return NextResponse.json({ ok: false, error: 'Missing parameters' });
    }

    const resp = await fetch(
      `${QBO_API_BASE}/v3/company/${realmId}/companyinfo/${realmId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      return NextResponse.json({ ok: false, error: err });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}
