/**
 * QUICKBOOKS TO ZATCA MAPPER (v1.2)
 * Translates QBO Invoice JSON into the Middleware's SimpleInvoiceInput shape.
 *
 * Note: the `seller` field is a placeholder. `generateInvoiceAction` overrides
 * it with the organization's onboarded seller details before signing.
 */
import type { SimpleInvoiceInput } from '@/lib/zatca/xml/builder';

const PLACEHOLDER_SELLER = {
  partyIdentification: { id: '', schemeID: 'CRN' as const },
  postalAddress: {
    streetName: '',
    buildingNumber: '0000',
    citySubdivisionName: '',
    cityName: '',
    postalZone: '00000',
    country: 'SA',
  },
  partyTaxScheme: { companyID: '' },
  partyLegalEntity: { registrationName: '' },
};

export function mapQBInvoiceToZatca(qbInvoice: any): SimpleInvoiceInput {
  const buyerTaxNumber =
    qbInvoice.CustomField?.find((f: any) => f.Name === 'TaxNumber')?.StringValue ||
    '300000000000003';

  return {
    type: 'standard',
    documentType: '388',
    id: qbInvoice.DocNumber || `QB-${qbInvoice.Id}`,
    issueDate: qbInvoice.TxnDate,
    issueTime: '12:00:00',
    currency: qbInvoice.CurrencyRef?.value || 'SAR',

    seller: PLACEHOLDER_SELLER,

    buyer: {
      partyIdentification: { id: buyerTaxNumber, schemeID: 'TIN' as const },
      postalAddress: {
        streetName: qbInvoice.BillAddr?.Line1 || 'Saudi Arabia',
        buildingNumber: qbInvoice.BillAddr?.Line2 || '0000',
        citySubdivisionName: qbInvoice.BillAddr?.Line3 || qbInvoice.BillAddr?.City || 'Riyadh',
        cityName: qbInvoice.BillAddr?.City || 'Riyadh',
        postalZone: qbInvoice.BillAddr?.PostalCode || '12211',
        country: 'SA',
      },
      partyTaxScheme: { companyID: buyerTaxNumber },
      partyLegalEntity: {
        registrationName: qbInvoice.CustomerRef?.name || 'Unknown Customer',
      },
    },

    items: (qbInvoice.Line || [])
      .filter((line: any) => line.DetailType === 'SalesItemLineDetail')
      .map((line: any) => ({
        name: line.Description || line.SalesItemLineDetail?.ItemRef?.name || 'Item',
        quantity: line.SalesItemLineDetail?.Qty || 1,
        unitPrice: line.SalesItemLineDetail?.UnitPrice || 0,
        vatRate: 15,
        vatCategory: 'S' as const,
      })),
  };
}

// Backwards-compatible alias for the old export name still referenced in some places.
export const mapQboToZatca = mapQBInvoiceToZatca;
