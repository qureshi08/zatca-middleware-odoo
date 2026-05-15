/**
 * Standard Invoice XML Generator (B2B - Tax Invoice)
 * Generates UBL 2.1 compliant XML for standard invoices
 */

import { create } from 'xmlbuilder2';
import type { ZATCAInvoice, InvoiceLine, TaxSubtotal } from '@/types/zatca';
import { formatDecimal, formatDate, formatTime } from './utils';

/**
 * Generate Standard Invoice XML (B2B)
 */
export function generateStandardInvoiceXML(invoice: ZATCAInvoice): string {
    const doc = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('Invoice', {
            'xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
            'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
            'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
            'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
        });

    // UBL Extensions (for signature, hash, QR code)
    const extensions = doc.ele('ext:UBLExtensions');

    // Extension for UBL signature
    const signatureExt = extensions.ele('ext:UBLExtension');
    signatureExt.ele('ext:ExtensionURI').txt('urn:oasis:names:specification:ubl:dsig:enveloped:xades');
    const extensionContent = signatureExt.ele('ext:ExtensionContent');
    // For ZATCA, this content must NOT be text. It will be replaced by the signature XML block.
    // We use a specific tag name that our signer can look for.
    extensionContent.ele('sig:UBLDocumentSignatures', {
        'xmlns:sig': 'urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2',
        'xmlns:sac': 'urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2',
        'xmlns:sbc': 'urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2',
    }).ele('sac:SignatureInformation')
        .ele('cbc:ID').txt('urn:oasis:names:specification:ubl:signature:1').up()
        .ele('sbc:ReferencedSignatureID').txt('urn:oasis:names:specification:ubl:signature:Invoice');

    // Customization ID (BT-24-1) — declares which ZATCA spec the invoice conforms to
    doc.ele('cbc:CustomizationID').txt('BR-KSA-CB');

    // Profile ID (BT-23)
    doc.ele('cbc:ProfileID').txt('reporting:1.0');

    // Invoice ID (BT-1)
    doc.ele('cbc:ID').txt(invoice.id);

    // UUID (KSA-1)
    doc.ele('cbc:UUID').txt(invoice.uuid);

    // Issue Date (BT-2)
    doc.ele('cbc:IssueDate').txt(invoice.issueDate);

    // Issue Time (KSA-25)
    doc.ele('cbc:IssueTime').txt(invoice.issueTime);

    // Invoice Type Code (BT-3)
    doc.ele('cbc:InvoiceTypeCode', { name: invoice.invoiceTypeCodeName })
        .txt(invoice.invoiceTypeCode);

    // Note (BT-22) - Optional
    if (invoice.note) {
        doc.ele('cbc:Note').txt(invoice.note);
    }

    // Document Currency Code (BT-5)
    doc.ele('cbc:DocumentCurrencyCode').txt(invoice.documentCurrencyCode);

    // Tax Currency Code (BT-6)
    doc.ele('cbc:TaxCurrencyCode').txt(invoice.taxCurrencyCode);

    // Billing Reference (BG-3) - For credit/debit notes
    if (invoice.billingReference) {
        const billingRef = doc.ele('cac:BillingReference');
        const invoiceDocRef = billingRef.ele('cac:InvoiceDocumentReference');
        invoiceDocRef.ele('cbc:ID').txt(invoice.billingReference.invoiceDocumentReference.id);
    }

    // Additional Document References
    invoice.additionalDocumentReference.forEach((ref) => {
        const adr = doc.ele('cac:AdditionalDocumentReference');
        adr.ele('cbc:ID').txt(ref.id);
        if (ref.uuid) {
            adr.ele('cbc:UUID').txt(ref.uuid);
        }
        if (ref.attachment) {
            const attachment = adr.ele('cac:Attachment');
            attachment.ele('cbc:EmbeddedDocumentBinaryObject', { mimeCode: ref.attachment.mimeCode || 'text/plain' })
                .txt(ref.attachment.embeddedDocumentBinaryObject);
        }
    });

    // Signature (KSA-15) - Required inside the body as well for UBL
    doc.ele('cac:Signature')
        .ele('cbc:ID').txt('urn:oasis:names:specification:ubl:signature:Invoice').up()
        .ele('cbc:SignatureMethod').txt('urn:oasis:names:specification:ubl:dsig:enveloped:xades');

    // Accounting Supplier Party (Seller) - BG-4
    const supplier = doc.ele('cac:AccountingSupplierParty').ele('cac:Party');

    // Seller Identification
    if (invoice.accountingSupplierParty.partyIdentification) {
        supplier.ele('cac:PartyIdentification')
            .ele('cbc:ID', { schemeID: invoice.accountingSupplierParty.partyIdentification.schemeID })
            .txt(invoice.accountingSupplierParty.partyIdentification.id);
    }

    // Seller Address
    const sAddr = supplier.ele('cac:PostalAddress');
    if (invoice.accountingSupplierParty.postalAddress) {
        sAddr.ele('cbc:StreetName').txt(invoice.accountingSupplierParty.postalAddress.streetName);
        if (invoice.accountingSupplierParty.postalAddress.additionalStreetName) {
            sAddr.ele('cbc:AdditionalStreetName')
                .txt(invoice.accountingSupplierParty.postalAddress.additionalStreetName);
        }
        sAddr.ele('cbc:BuildingNumber').txt(invoice.accountingSupplierParty.postalAddress.buildingNumber);
        if (invoice.accountingSupplierParty.postalAddress.additionalNumber) {
            sAddr.ele('cbc:PlotIdentification').txt(invoice.accountingSupplierParty.postalAddress.additionalNumber);
        }
        sAddr.ele('cbc:CitySubdivisionName')
            .txt(invoice.accountingSupplierParty.postalAddress.citySubdivisionName);
        sAddr.ele('cbc:CityName').txt(invoice.accountingSupplierParty.postalAddress.cityName);
        sAddr.ele('cbc:PostalZone').txt(invoice.accountingSupplierParty.postalAddress.postalZone);
        if (invoice.accountingSupplierParty.postalAddress.countrySubentity) {
            sAddr.ele('cbc:CountrySubentity')
                .txt(invoice.accountingSupplierParty.postalAddress.countrySubentity);
        }
        sAddr.ele('cac:Country').ele('cbc:IdentificationCode').txt(invoice.accountingSupplierParty.postalAddress.country);
    }

    // Seller Tax Scheme
    supplier.ele('cac:PartyTaxScheme')
        .ele('cbc:CompanyID').txt(invoice.accountingSupplierParty.partyTaxScheme.companyID).up()
        .ele('cac:TaxScheme').ele('cbc:ID').txt('VAT');

    // Seller Legal Entity
    supplier.ele('cac:PartyLegalEntity')
        .ele('cbc:RegistrationName').txt(invoice.accountingSupplierParty.partyLegalEntity.registrationName);

    // Accounting Customer Party (Buyer) - BG-7
    const customer = doc.ele('cac:AccountingCustomerParty').ele('cac:Party');

    // Buyer Identification (Optional for B2C)
    if (invoice.accountingCustomerParty.partyIdentification) {
        customer.ele('cac:PartyIdentification')
            .ele('cbc:ID', { schemeID: invoice.accountingCustomerParty.partyIdentification.schemeID })
            .txt(invoice.accountingCustomerParty.partyIdentification.id);
    }

    // Buyer Address
    const cAddr = customer.ele('cac:PostalAddress');
    cAddr.ele('cbc:StreetName').txt(invoice.accountingCustomerParty.postalAddress.streetName);
    if (invoice.accountingCustomerParty.postalAddress.additionalStreetName) {
        cAddr.ele('cbc:AdditionalStreetName')
            .txt(invoice.accountingCustomerParty.postalAddress.additionalStreetName);
    }
    cAddr.ele('cbc:BuildingNumber').txt(invoice.accountingCustomerParty.postalAddress.buildingNumber);
    if (invoice.accountingCustomerParty.postalAddress.additionalNumber) {
        cAddr.ele('cbc:PlotIdentification').txt(invoice.accountingCustomerParty.postalAddress.additionalNumber);
    }
    cAddr.ele('cbc:CitySubdivisionName')
        .txt(invoice.accountingCustomerParty.postalAddress.citySubdivisionName);
    cAddr.ele('cbc:CityName').txt(invoice.accountingCustomerParty.postalAddress.cityName);
    cAddr.ele('cbc:PostalZone').txt(invoice.accountingCustomerParty.postalAddress.postalZone);
    if (invoice.accountingCustomerParty.postalAddress.countrySubentity) {
        cAddr.ele('cbc:CountrySubentity')
            .txt(invoice.accountingCustomerParty.postalAddress.countrySubentity);
    }
    cAddr.ele('cac:Country').ele('cbc:IdentificationCode').txt(invoice.accountingCustomerParty.postalAddress.country);

    // Buyer Tax Scheme (Optional)
    if (invoice.accountingCustomerParty.partyTaxScheme?.companyID) {
        customer.ele('cac:PartyTaxScheme')
            .ele('cbc:CompanyID').txt(invoice.accountingCustomerParty.partyTaxScheme.companyID!).up()
            .ele('cac:TaxScheme').ele('cbc:ID').txt('VAT');
    } else {
        // ZATCA still expects the TaxScheme block even if CompanyID is missing for B2C,
        // but this is the Standard Invoice (B2B).
        customer.ele('cac:PartyTaxScheme')
            .ele('cac:TaxScheme').ele('cbc:ID').txt('VAT');
    }

    // Buyer Legal Entity
    customer.ele('cac:PartyLegalEntity')
        .ele('cbc:RegistrationName').txt(invoice.accountingCustomerParty.partyLegalEntity.registrationName);

    // Delivery (KSA-5 Supply Date)
    if (invoice.delivery) {
        const delivery = doc.ele('cac:Delivery');
        if (invoice.delivery.actualDeliveryDate) {
            delivery.ele('cbc:ActualDeliveryDate').txt(invoice.delivery.actualDeliveryDate);
        }
        if (invoice.delivery.latestDeliveryDate) {
            delivery.ele('cbc:LatestDeliveryDate').txt(invoice.delivery.latestDeliveryDate);
        }
    }

    // Payment Means (BG-16) - Optional
    if (invoice.paymentMeans) {
        const pm = doc.ele('cac:PaymentMeans');
        pm.ele('cbc:PaymentMeansCode').txt(invoice.paymentMeans.paymentMeansCode);
        if (invoice.paymentMeans.instructionNote) {
            pm.ele('cbc:InstructionNote').txt(invoice.paymentMeans.instructionNote);
        }
    }

    // Document Level Allowances/Charges (BG-20, BG-21) - Optional
    if (invoice.allowanceCharge) {
        invoice.allowanceCharge.forEach((node) => {
            const allowanceCharge = doc.ele('cac:AllowanceCharge');
            allowanceCharge.ele('cbc:ChargeIndicator').txt(node.chargeIndicator.toString());
            allowanceCharge.ele('cbc:AllowanceChargeReasonCode').txt(node.allowanceChargeReasonCode);
            allowanceCharge.ele('cbc:AllowanceChargeReason').txt(node.allowanceChargeReason);
            if (node.multiplierFactorNumeric !== undefined) {
                allowanceCharge.ele('cbc:MultiplierFactorNumeric').txt(formatDecimal(node.multiplierFactorNumeric));
            }
            allowanceCharge.ele('cbc:Amount', { currencyID: invoice.documentCurrencyCode })
                .txt(formatDecimal(node.amount));
            if (node.baseAmount !== undefined) {
                allowanceCharge.ele('cbc:BaseAmount', { currencyID: invoice.documentCurrencyCode })
                    .txt(formatDecimal(node.baseAmount));
            }
            const taxCategory = allowanceCharge.ele('cac:TaxCategory');
            taxCategory.ele('cbc:ID').txt(node.taxCategory.id);
            taxCategory.ele('cbc:Percent').txt(formatDecimal(node.taxCategory.percent));
            const taxScheme = taxCategory.ele('cac:TaxScheme');
            taxScheme.ele('cbc:ID').txt('VAT');
        });
    }

    // Tax Total (BG-22) - Block 1: Document Currency (with subtotals)
    invoice.taxTotal.forEach((tt) => {
        const taxTotalNode = doc.ele('cac:TaxTotal');
        taxTotalNode.ele('cbc:TaxAmount', { currencyID: invoice.documentCurrencyCode })
            .txt(formatDecimal(tt.taxAmount));

        // Tax Subtotals (BG-23)
        tt.taxSubtotal.forEach((st) => {
            const taxSubtotal = taxTotalNode.ele('cac:TaxSubtotal');
            taxSubtotal.ele('cbc:TaxableAmount', { currencyID: invoice.documentCurrencyCode })
                .txt(formatDecimal(st.taxableAmount));
            taxSubtotal.ele('cbc:TaxAmount', { currencyID: invoice.documentCurrencyCode })
                .txt(formatDecimal(st.taxAmount));

            const taxCategory = taxSubtotal.ele('cac:TaxCategory');
            taxCategory.ele('cbc:ID').txt(st.taxCategory.id);
            taxCategory.ele('cbc:Percent').txt(formatDecimal(st.taxCategory.percent));

            if (st.taxCategory.taxExemptionReasonCode) {
                taxCategory.ele('cbc:TaxExemptionReasonCode').txt(st.taxCategory.taxExemptionReasonCode);
            }
            if (st.taxCategory.taxExemptionReason) {
                taxCategory.ele('cbc:TaxExemptionReason').txt(st.taxCategory.taxExemptionReason);
            }

            const taxScheme = taxCategory.ele('cac:TaxScheme');
            taxScheme.ele('cbc:ID').txt('VAT');
        });
    });

    // Tax Total (BG-22) - Block 2: SAR Currency (WITHOUT subtotals)
    // Mandatory when document currency is not SAR or to satisfy BR-KSA-EN16931-09
    const taxCurrencyTotal = doc.ele('cac:TaxTotal');
    taxCurrencyTotal.ele('cbc:TaxAmount', { currencyID: invoice.taxCurrencyCode })
        .txt(formatDecimal(invoice.taxTotal[0].taxAmount));

    // Legal Monetary Total (BG-22)
    const lmt = doc.ele('cac:LegalMonetaryTotal');
    lmt.ele('cbc:LineExtensionAmount', { currencyID: invoice.documentCurrencyCode })
        .txt(formatDecimal(invoice.legalMonetaryTotal.lineExtensionAmount));

    if (invoice.legalMonetaryTotal.allowanceTotalAmount !== undefined) {
        lmt.ele('cbc:AllowanceTotalAmount', { currencyID: invoice.documentCurrencyCode })
            .txt(formatDecimal(invoice.legalMonetaryTotal.allowanceTotalAmount));
    }

    if (invoice.legalMonetaryTotal.chargeTotalAmount !== undefined) {
        lmt.ele('cbc:ChargeTotalAmount', { currencyID: invoice.documentCurrencyCode })
            .txt(formatDecimal(invoice.legalMonetaryTotal.chargeTotalAmount));
    }

    lmt.ele('cbc:TaxExclusiveAmount', { currencyID: invoice.documentCurrencyCode })
        .txt(formatDecimal(invoice.legalMonetaryTotal.taxExclusiveAmount));
    lmt.ele('cbc:TaxInclusiveAmount', { currencyID: invoice.documentCurrencyCode })
        .txt(formatDecimal(invoice.legalMonetaryTotal.taxInclusiveAmount));

    if (invoice.legalMonetaryTotal.prepaidAmount !== undefined) {
        lmt.ele('cbc:PrepaidAmount', { currencyID: invoice.documentCurrencyCode })
            .txt(formatDecimal(invoice.legalMonetaryTotal.prepaidAmount));
    }

    if (invoice.legalMonetaryTotal.payableRoundingAmount !== undefined) {
        lmt.ele('cbc:PayableRoundingAmount', { currencyID: invoice.documentCurrencyCode })
            .txt(formatDecimal(invoice.legalMonetaryTotal.payableRoundingAmount));
    }

    lmt.ele('cbc:PayableAmount', { currencyID: invoice.documentCurrencyCode })
        .txt(formatDecimal(invoice.legalMonetaryTotal.payableAmount));

    // Invoice Lines (BG-25)
    invoice.invoiceLine.forEach((iLine) => {
        const invoiceLine = doc.ele('cac:InvoiceLine');

        // Line ID (BT-126)
        invoiceLine.ele('cbc:ID').txt(iLine.id);

        // Line Note (BT-127) - Optional
        if (iLine.note) {
            invoiceLine.ele('cbc:Note').txt(iLine.note);
        }

        // Invoiced Quantity (BT-129, BT-130)
        invoiceLine.ele('cbc:InvoicedQuantity', { unitCode: iLine.invoicedQuantityUnitCode })
            .txt(formatDecimal(iLine.invoicedQuantity));

        // Line Extension Amount (BT-131)
        invoiceLine.ele('cbc:LineExtensionAmount', { currencyID: invoice.documentCurrencyCode })
            .txt(formatDecimal(iLine.lineExtensionAmount));

        // Line Tax Total (KSA-11, KSA-12) - Required for Tax Invoice
        if (iLine.taxTotal) {
            const lineTaxTotal = invoiceLine.ele('cac:TaxTotal');
            lineTaxTotal.ele('cbc:TaxAmount', { currencyID: invoice.taxCurrencyCode })
                .txt(formatDecimal(iLine.taxTotal.taxAmount));
            lineTaxTotal.ele('cbc:RoundingAmount', { currencyID: invoice.documentCurrencyCode })
                .txt(formatDecimal(iLine.taxTotal.roundingAmount));
        }

        // Item (BG-31)
        const item = invoiceLine.ele('cac:Item');
        item.ele('cbc:Name').txt(iLine.item.name);

        // Item Identifications - Optional
        if (iLine.item.buyersItemIdentification) {
            const buyersId = item.ele('cac:BuyersItemIdentification');
            buyersId.ele('cbc:ID').txt(iLine.item.buyersItemIdentification.id);
        }
        if (iLine.item.sellersItemIdentification) {
            const sellersId = item.ele('cac:SellersItemIdentification');
            sellersId.ele('cbc:ID').txt(iLine.item.sellersItemIdentification.id);
        }
        if (iLine.item.standardItemIdentification) {
            const standardId = item.ele('cac:StandardItemIdentification');
            standardId.ele('cbc:ID').txt(iLine.item.standardItemIdentification.id);
        }

        // Classified Tax Category
        const classifiedTaxCategory = item.ele('cac:ClassifiedTaxCategory');
        classifiedTaxCategory.ele('cbc:ID').txt(iLine.item.classifiedTaxCategory.id);
        classifiedTaxCategory.ele('cbc:Percent').txt(formatDecimal(iLine.item.classifiedTaxCategory.percent));
        const taxScheme = classifiedTaxCategory.ele('cac:TaxScheme');
        taxScheme.ele('cbc:ID').txt('VAT');

        // Price (BG-29)
        const price = invoiceLine.ele('cac:Price');
        price.ele('cbc:PriceAmount', { currencyID: invoice.documentCurrencyCode })
            .txt(formatDecimal(iLine.price.priceAmount));

        if (iLine.price.baseQuantity !== undefined) {
            price.ele('cbc:BaseQuantity', { unitCode: iLine.invoicedQuantityUnitCode })
                .txt(formatDecimal(iLine.price.baseQuantity));
        }

        // Price Allowance (Item gross price) - Optional
        if (iLine.price.allowanceCharge) {
            const priceAllowance = price.ele('cac:AllowanceCharge');
            priceAllowance.ele('cbc:ChargeIndicator').txt('false');
            priceAllowance.ele('cbc:Amount', { currencyID: invoice.documentCurrencyCode })
                .txt(formatDecimal(iLine.price.allowanceCharge.amount));
            priceAllowance.ele('cbc:BaseAmount', { currencyID: invoice.documentCurrencyCode })
                .txt(formatDecimal(iLine.price.allowanceCharge.baseAmount));
        }

        // Line Allowances/Charges (BG-27, BG-28) - Optional
        if (iLine.allowanceCharges) {
            iLine.allowanceCharges.forEach((ac) => {
                const allowanceCharge = invoiceLine.ele('cac:AllowanceCharge');
                allowanceCharge.ele('cbc:ChargeIndicator').txt(ac.chargeIndicator.toString());

                if (ac.allowanceChargeReasonCode) {
                    allowanceCharge.ele('cbc:AllowanceChargeReasonCode').txt(ac.allowanceChargeReasonCode);
                }
                if (ac.allowanceChargeReason) {
                    allowanceCharge.ele('cbc:AllowanceChargeReason').txt(ac.allowanceChargeReason);
                }
                if (ac.multiplierFactorNumeric !== undefined) {
                    allowanceCharge.ele('cbc:MultiplierFactorNumeric').txt(formatDecimal(ac.multiplierFactorNumeric));
                }

                allowanceCharge.ele('cbc:Amount', { currencyID: invoice.documentCurrencyCode })
                    .txt(formatDecimal(ac.amount));

                if (ac.baseAmount !== undefined) {
                    allowanceCharge.ele('cbc:BaseAmount', { currencyID: invoice.documentCurrencyCode })
                        .txt(formatDecimal(ac.baseAmount));
                }
            });
        }
    });

    return doc.end({ prettyPrint: false });
}
