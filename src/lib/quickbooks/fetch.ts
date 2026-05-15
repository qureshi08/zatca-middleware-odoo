import { getValidQBToken } from './server-auth';

export const QBO_API_BASE =
  process.env.QBO_API_BASE ?? 'https://sandbox-quickbooks.api.intuit.com';

export async function fetchInvoiceFromQuickbooks(
  orgId: string,
  realmId: string,
  invoiceId: string
) {
  const token = await getValidQBToken(orgId);
  const url = `${QBO_API_BASE}/v3/company/${realmId}/invoice/${invoiceId}?minorversion=65`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`QBO fetch error: ${txt}`);
  }
  const data = await resp.json();
  return data.Invoice;
}
