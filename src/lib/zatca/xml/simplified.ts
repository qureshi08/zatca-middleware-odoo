/**
 * Simplified Invoice XML Generator (B2C - Simplified Tax Invoice)
 * Generates UBL 2.1 compliant XML for simplified invoices
 */

import { create } from 'xmlbuilder2';
import type { ZATCAInvoice, InvoiceLine } from '@/types/zatca';
import { formatDecimal } from './utils';

/**
 * Generate Simplified Invoice XML (B2C)
 * Simplified invoices have fewer requirements than standard invoices
 */
export function generateSimplifiedInvoiceXML(invoice: ZATCAInvoice): string {
    const doc = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('Invoice', {
            'xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
            'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
            'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
            'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
        });

    // UBL Extensions
    const extensions = doc.ele('ext:UBLExtensions');

    // Extension for UBL signature
    const signatureExt = extensions.ele('ext:UBLExtension');
    signatureExt.ele('ext:ExtensionURI').txt('urn:oasis:names:specification:ubl:dsig:enveloped:xades');
    const extensionContent = signatureExt.ele('ext:ExtensionContent');
    extensionContent.ele('sig:UBLDocumentSignatures', {
        'xmlns:sig': 'urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2',
        'xmlns:sac': 'urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2',
        'xmlns:sbc': 'urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2',
    }).ele('sac:SignatureInformation')
        .ele('cbc:ID').txt('urn:oasis:names:specification:ubl:signature:1').up()
        .ele('sbc:ReferencedSignatureID').txt('urn:oasis:names:specification:ubl:signature:Invoice');

    // Customization ID (BT-24-1) — declares which ZATCA spec the invoice conforms to
    doc.ele('cbc:CustomizationID').txt('BR-KSA-CB');

    // Profile ID
    doc.ele('cbc:ProfileID').txt('reporting:1.0');

    // Invoice ID
    doc.ele('cbc:ID').txt(invoice.id);

    // UUID
    doc.ele('cbc:UUID').txt(invoice.uuid);

    // Issue Date
    doc.ele('cbc:IssueDate').txt(invoice.issueDate);

    // Issue Time
    doc.ele('cbc:IssueTime').txt(invoice.issueTime);

    // Invoice Type Code
    doc.ele('cbc:InvoiceTypeCode', { name: invoice.invoiceTypeCodeName })
        .txt(invoice.invoiceTypeCode);

    // Note - Optional
    if (invoice.note) {
        doc.ele('cbc:Note').txt(invoice.note);
    }

    // Document Currency Code
    doc.ele('cbc:DocumentCurrencyCode').txt(invoice.documentCurrencyCode);

    // Tax Currency Code
    doc.ele('cbc:TaxCurrencyCode').txt(invoice.taxCurrencyCode);

    // Billing Reference - For credit/debit notes
    if (invoice.billingReference) {
        const billingRef = doc.ele('cac:BillingReference');
        const invoiceDocRef = billingRef.ele('cac:InvoiceDocumentReference');
        invoiceDocRef.ele('cbc:ID').txt(invoice.billingReference.invoiceDocumentReference.id);
    }

    // Additional Document References
    invoice.additionalDocumentReference.forEach((ref) => {
        const docRef = doc.ele('cac:AdditionalDocumentReference');
        docRef.ele('cbc:ID').txt(ref.id);

        if (ref.uuid) {
            docRef.ele('cbc:UUID').txt(ref.uuid);
        }

        if (ref.attachment) {
            const attachment = docRef.ele('cac:Attachment');
            attachment.ele('cbc:EmbeddedDocumentBinaryObject', {
                mimeCode: ref.attachment.mimeCode || 'text/plain'
            }).txt(ref.attachment.embeddedDocumentBinaryObject);
        }
    });

    // Signature (KSA-15) - Required for simplified invoices
    if (invoice.signature) {
        invoice.signature.forEach((sig) => {
            const signature = doc.ele('cac:Signature');
            signature.ele('cbc:ID').txt(sig.id);
            signature.ele('cbc:SignatureMethod').txt(sig.signatureMethod);
        });
    }

    // Accounting Supplier Party (Seller)
    const supplierParty = doc.ele('cac:AccountingSupplierParty');
    const supplier = supplierParty.ele('cac:Party');

    // Seller Identification
    if (invoice.accountingSupplierParty.partyIdentification) {
        const supplierIdentification = supplier.ele('cac:PartyIdentification');
        supplierIdentification.ele('cbc:ID', {
            schemeID: invoice.accountingSupplierParty.partyIdentification.schemeID
        }).txt(invoice.accountingSupplierParty.partyIdentification.id);
    }

    // Seller Address
    const supplierAddress = supplier.ele('cac:PostalAddress');
    if (invoice.accountingSupplierParty.postalAddress) {
        supplierAddress.ele('cbc:StreetName').txt(invoice.accountingSupplierParty.postalAddress.streetName);
        if (invoice.accountingSupplierParty.postalAddress.additionalStreetName) {
            supplierAddress.ele('cbc:AdditionalStreetName')
                .txt(invoice.accountingSupplierParty.postalAddress.additionalStreetName);
        }
        supplierAddress.ele('cbc:BuildingNumber').txt(invoice.accountingSupplierParty.postalAddress.buildingNumber);
        if (invoice.accountingSupplierParty.postalAddress.additionalNumber) {
            supplierAddress.ele('cbc:PlotIdentification').txt(invoice.accountingSupplierParty.postalAddress.additionalNumber);
        }
        supplierAddress.ele('cbc:CitySubdivisionName')
            .txt(invoice.accountingSupplierParty.postalAddress.citySubdivisionName);
        supplierAddress.ele('cbc:CityName').txt(invoice.accountingSupplierParty.postalAddress.cityName);
        supplierAddress.ele('cbc:PostalZone').txt(invoice.accountingSupplierParty.postalAddress.postalZone);
        if (invoice.accountingSupplierParty.postalAddress.countrySubentity) {
            supplierAddress.ele('cbc:CountrySubentity')
                .txt(invoice.accountingSupplierParty.postalAddress.countrySubentity);
        }
        const supplierCountry = supplierAddress.ele('cac:Country');
        supplierCountry.ele('cbc:IdentificationCode').txt(invoice.accountingSupplierParty.postalAddress.country);
    }

    // Seller Tax Scheme
    const supplierTaxScheme = supplier.ele('cac:PartyTaxScheme');
    if (invoice.accountingSupplierParty.partyTaxScheme) {
        supplierTaxScheme.ele('cbc:CompanyID').txt(invoice.accountingSupplierParty.partyTaxScheme.companyID);
        const supplierTaxSchemeNode = supplierTaxScheme.ele('cac:TaxScheme');
        supplierTaxSchemeNode.ele('cbc:ID').txt('VAT');
    }

    // Seller Legal Entity
    const supplierLegalEntity = supplier.ele('cac:PartyLegalEntity');
    if (invoice.accountingSupplierParty.partyLegalEntity) {
        supplierLegalEntity.ele('cbc:RegistrationName')
            .txt(invoice.accountingSupplierParty.partyLegalEntity.registrationName);
    }

    // Accounting Customer Party (Buyer) - Optional for simplified invoices
    if (invoice.accountingCustomerParty) {
        const customerParty = doc.ele('cac:AccountingCustomerParty');
        const customer = customerParty.ele('cac:Party');

        // Buyer Address (minimal for B2C)
        if (invoice.accountingCustomerParty.postalAddress) {
            const customerAddress = customer.ele('cac:PostalAddress');
            customerAddress.ele('cbc:StreetName').txt(invoice.accountingCustomerParty.postalAddress.streetName);
            customerAddress.ele('cbc:BuildingNumber').txt(invoice.accountingCustomerParty.postalAddress.buildingNumber);
            if (invoice.accountingCustomerParty.postalAddress.additionalNumber) {
                customerAddress.ele('cbc:PlotIdentification').txt(invoice.accountingCustomerParty.postalAddress.additionalNumber);
            }
            customerAddress.ele('cbc:CitySubdivisionName')
                .txt(invoice.accountingCustomerParty.postalAddress.citySubdivisionName);
            customerAddress.ele('cbc:CityName').txt(invoice.accountingCustomerParty.postalAddress.cityName);
            customerAddress.ele('cbc:PostalZone').txt(invoice.accountingCustomerParty.postalAddress.postalZone);
            const customerCountry = customerAddress.ele('cac:Country');
            customerCountry.ele('cbc:IdentificationCode').txt(invoice.accountingCustomerParty.postalAddress.country);
        }

        // Buyer Legal Entity
        if (invoice.accountingCustomerParty.partyLegalEntity) {
            const customerLegalEntity = customer.ele('cac:PartyLegalEntity');
            customerLegalEntity.ele('cbc:RegistrationName')
                .txt(invoice.accountingCustomerParty.partyLegalEntity.registrationName);
        }
    }

    // Delivery - Optional
    if (invoice.delivery) {
        const delivery = doc.ele('cac:Delivery');
        if (invoice.delivery.actualDeliveryDate) {
            delivery.ele('cbc:ActualDeliveryDate').txt(invoice.delivery.actualDeliveryDate);
        }
        if (invoice.delivery.latestDeliveryDate) {
            delivery.ele('cbc:LatestDeliveryDate').txt(invoice.delivery.latestDeliveryDate);
        }
    }

    // Payment Means - Optional
    if (invoice.paymentMeans) {
        const paymentMeans = doc.ele('cac:PaymentMeans');
        paymentMeans.ele('cbc:PaymentMeansCode').txt(invoice.paymentMeans.paymentMeansCode);
        if (invoice.paymentMeans.instructionNote) {
            paymentMeans.ele('cbc:InstructionNote').txt(invoice.paymentMeans.instructionNote);
        }
    }

    // Tax Total (BG-22) - Block 1: Document Currency (with subtotals)
    invoice.taxTotal.forEach((taxTotal) => {
        const taxTotalNode = doc.ele('cac:TaxTotal');
        taxTotalNode.ele('cbc:TaxAmount', { currencyID: invoice.documentCurrencyCode })
            .txt(formatDecimal(taxTotal.taxAmount));

        // Tax Subtotals
        taxTotal.taxSubtotal.forEach((subtotal) => {
            const taxSubtotal = taxTotalNode.ele('cac:TaxSubtotal');
            taxSubtotal.ele('cbc:TaxableAmount', { currencyID: invoice.documentCurrencyCode })
                .txt(formatDecimal(subtotal.taxableAmount));
            taxSubtotal.ele('cbc:TaxAmount', { currencyID: invoice.documentCurrencyCode })
                .txt(formatDecimal(subtotal.taxAmount));

            const taxCategory = taxSubtotal.ele('cac:TaxCategory');
            taxCategory.ele('cbc:ID').txt(subtotal.taxCategory.id);
            taxCategory.ele('cbc:Percent').txt(formatDecimal(subtotal.taxCategory.percent));

            if (subtotal.taxCategory.taxExemptionReasonCode) {
                taxCategory.ele('cbc:TaxExemptionReasonCode').txt(subtotal.taxCategory.taxExemptionReasonCode);
            }
            if (subtotal.taxCategory.taxExemptionReason) {
                taxCategory.ele('cbc:TaxExemptionReason').txt(subtotal.taxCategory.taxExemptionReason);
            }

            const taxScheme = taxCategory.ele('cac:TaxScheme');
            taxScheme.ele('cbc:ID').txt('VAT');
        });
    });

    // Tax Total (BG-22) - Block 2: SAR Currency (WITHOUT subtotals)
    const taxCurrencyTotal = doc.ele('cac:TaxTotal');
    taxCurrencyTotal.ele('cbc:TaxAmount', { currencyID: invoice.taxCurrencyCode })
        .txt(formatDecimal(invoice.taxTotal[0].taxAmount));

    // Legal Monetary Total
    const legalMonetaryTotal = doc.ele('cac:LegalMonetaryTotal');
    legalMonetaryTotal.ele('cbc:LineExtensionAmount', { currencyID: invoice.documentCurrencyCode })
        .txt(formatDecimal(invoice.legalMonetaryTotal.lineExtensionAmount));

    if (invoice.legalMonetaryTotal.allowanceTotalAmount !== undefined) {
        legalMonetaryTotal.ele('cbc:AllowanceTotalAmount', { currencyID: invoice.documentCurrencyCode })
            .txt(formatDecimal(invoice.legalMonetaryTotal.allowanceTotalAmount));
    }

    if (invoice.legalMonetaryTotal.chargeTotalAmount !== undefined) {
        legalMonetaryTotal.ele('cbc:ChargeTotalAmount', { currencyID: invoice.documentCurrencyCode })
            .txt(formatDecimal(invoice.legalMonetaryTotal.chargeTotalAmount));
    }

    legalMonetaryTotal.ele('cbc:TaxExclusiveAmount', { currencyID: invoice.documentCurrencyCode })
        .txt(formatDecimal(invoice.legalMonetaryTotal.taxExclusiveAmount));
    legalMonetaryTotal.ele('cbc:TaxInclusiveAmount', { currencyID: invoice.documentCurrencyCode })
        .txt(formatDecimal(invoice.legalMonetaryTotal.taxInclusiveAmount));

    if (invoice.legalMonetaryTotal.prepaidAmount !== undefined) {
        legalMonetaryTotal.ele('cbc:PrepaidAmount', { currencyID: invoice.documentCurrencyCode })
            .txt(formatDecimal(invoice.legalMonetaryTotal.prepaidAmount));
    }

    legalMonetaryTotal.ele('cbc:PayableAmount', { currencyID: invoice.documentCurrencyCode })
        .txt(formatDecimal(invoice.legalMonetaryTotal.payableAmount));

    // Invoice Lines
    invoice.invoiceLine.forEach((line) => {
        addSimplifiedInvoiceLine(doc, line, invoice.documentCurrencyCode);
    });

    return doc.end({ prettyPrint: false });
}

/**
 * Add simplified invoice line to XML
 */
function addSimplifiedInvoiceLine(
    doc: any,
    line: InvoiceLine,
    documentCurrency: string
): void {
    const invoiceLine = doc.ele('cac:InvoiceLine');

    // Line ID
    invoiceLine.ele('cbc:ID').txt(line.id);

    // Line Note - Optional
    if (line.note) {
        invoiceLine.ele('cbc:Note').txt(line.note);
    }

    // Invoiced Quantity
    invoiceLine.ele('cbc:InvoicedQuantity', { unitCode: line.invoicedQuantityUnitCode })
        .txt(formatDecimal(line.invoicedQuantity));

    // Line Extension Amount
    invoiceLine.ele('cbc:LineExtensionAmount', { currencyID: documentCurrency })
        .txt(formatDecimal(line.lineExtensionAmount));

    // Item
    const item = invoiceLine.ele('cac:Item');
    item.ele('cbc:Name').txt(line.item.name);

    // Classified Tax Category
    const classifiedTaxCategory = item.ele('cac:ClassifiedTaxCategory');
    classifiedTaxCategory.ele('cbc:ID').txt(line.item.classifiedTaxCategory.id);
    classifiedTaxCategory.ele('cbc:Percent').txt(formatDecimal(line.item.classifiedTaxCategory.percent));
    const taxScheme = classifiedTaxCategory.ele('cac:TaxScheme');
    taxScheme.ele('cbc:ID').txt('VAT');

    // Price
    const price = invoiceLine.ele('cac:Price');
    price.ele('cbc:PriceAmount', { currencyID: documentCurrency })
        .txt(formatDecimal(line.price.priceAmount));
}
