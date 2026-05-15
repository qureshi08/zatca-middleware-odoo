import { submitClearance, submitReporting, logToTrace } from './api/client';
import { getOnboardingStatus } from './onboarding-storage';
import { hashInvoiceForSubmission } from './crypto/hash';

export interface TransactionResult {
    success: boolean;
    status: 'CLEARED' | 'REPORTED' | 'REJECTED' | 'WARNING';
    type: 'standard' | 'simplified';
    invoiceId: string;
    uuid: string;
    error?: string;
    validationMessages?: any[];
    clearedXml?: string;
    originalXml?: string;
    timestamp: string;
}

/**
 * Unified Handler for ZATCA Transactions (Clearance & Reporting)
 * Now multi-tenant: Pulls credentials for the specific organization.
 */
export async function processZATCATransaction(
    xml: string,
    type: 'standard' | 'simplified',
    invoiceId: string,
    uuid: string,
    orgId: string
): Promise<TransactionResult> {
    const status = await getOnboardingStatus(orgId);

    // We prefer Production CSID if available, fallback to Compliance CSID for testing
    const token = status.productionCSID || status.complianceCSID;
    const secret = status.productionSecret || status.complianceSecret;

    // Simulation detection based on the Request ID prefix
    const isSimulated = status.complianceRequestId?.startsWith('SIM-');

    if (!token) {
        return {
            success: false,
            status: 'REJECTED',
            type,
            invoiceId,
            uuid,
            error: 'Bank system not registered or missing production credentials. Please complete onboarding first.',
            timestamp: new Date().toISOString()
        };
    }

    const invoiceHash = hashInvoiceForSubmission(xml);
    const b64Xml = Buffer.from(xml).toString('base64');

    if (isSimulated) {
        return handleSimulation(xml, type, invoiceId, uuid, invoiceHash);
    }

    const MAX_RETRIES = 3;
    let attempt = 0;
    let lastError = '';

    while (attempt < MAX_RETRIES) {
        try {
            attempt++;
            console.log(`[ZATCA-${orgId}] Submission Attempt ${attempt} for ${invoiceId}...`);

            let response;
            if (type === 'standard') {
                response = await submitClearance(b64Xml, invoiceHash, uuid, token, secret || '');
            } else {
                response = await submitReporting(b64Xml, invoiceHash, uuid, token, secret || '');
            }

            if (!response.success) {
                // Check if error is transient (e.g., timeout, 5xx)
                const isTransient = response.error?.toLowerCase().includes('timeout') ||
                    response.error?.toLowerCase().includes('fetch') ||
                    (response.data?.status >= 500);

                if (isTransient && attempt < MAX_RETRIES) {
                    const delay = attempt * 1000;
                    console.warn(`[ZATCA] Transient error detected: ${response.error}. Retrying in ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }

                console.error(`[ZATCA] Submission rejected for ${invoiceId}:`, response.error);
                return {
                    success: false,
                    status: 'REJECTED',
                    type,
                    invoiceId,
                    uuid,
                    error: response.error,
                    validationMessages: response.data?.validationResults?.errorMessages || [],
                    timestamp: new Date().toISOString()
                };
            }

            // ZATCA success! 
            const validationStatus = response.data.validationResults?.status;
            const hasWarnings = validationStatus === 'WARNING' || (response.data.validationResults?.warningMessages?.length > 0);

            const zatcaStatus = hasWarnings ? 'WARNING' :
                (response.data.clearedInvoice ? 'CLEARED' : 'REPORTED');

            const clearedXml = response.data.clearedInvoice
                ? Buffer.from(response.data.clearedInvoice, 'base64').toString('utf8')
                : undefined;

            return {
                success: true,
                status: zatcaStatus as any,
                type,
                invoiceId,
                uuid,
                clearedXml,
                originalXml: xml,
                validationMessages: [
                    ...(response.data.validationResults?.warningMessages || []),
                    ...(response.data.validationResults?.infoMessages || [])
                ],
                timestamp: new Date().toISOString()
            };

        } catch (error: any) {
            lastError = error.message;
            if (attempt < MAX_RETRIES) {
                const delay = attempt * 1000;
                console.warn(`[ZATCA] Exception during submission: ${lastError}. Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            break;
        }
    }

    return {
        success: false,
        status: 'REJECTED',
        type,
        invoiceId,
        uuid,
        error: `Submission failed after ${MAX_RETRIES} attempts: ${lastError}`,
        timestamp: new Date().toISOString()
    };
}

/**
 * Handles Simulation Mode logic to match ZATCA Sandbox behavior
 */
async function handleSimulation(
    xml: string,
    type: 'standard' | 'simplified',
    invoiceId: string,
    uuid: string,
    invoiceHash: string
): Promise<TransactionResult> {
    console.log(`[ZATCA SIMULATION] Validating ${type} transaction for ${invoiceId}`);

    // Run the comprehensive ZATCA business-rule validator.
    // The validator returns structured errors and warnings that mirror what
    // real ZATCA Compliance/Production endpoints would surface.
    const { validateZatcaXml } = await import('./validation/rules');
    const report = validateZatcaXml(xml, type);

    if (report.errors.length > 0) {
        return {
            success: false,
            status: 'REJECTED',
            type,
            invoiceId,
            uuid,
            error: `ZATCA Validation Error (Simulated): ${report.errors.length} rule(s) failed`,
            validationMessages: report.errors,
            timestamp: new Date().toISOString()
        };
    }

    // Optional manual trigger kept for QA: any invoice containing the literal
    // string TRIGGER_ZATCA_WARNING is reported with a synthetic warning even
    // if no real warning rules fire.
    const manualWarning = xml.includes('TRIGGER_ZATCA_WARNING');
    const allWarnings = manualWarning
        ? [
            ...report.warnings,
            {
                code: 'SIM_W_001',
                category: 'KSA' as const,
                status: 'WARNING' as const,
                message: 'Simulated Warning: Invoice accepted but requires minor technical review.'
            }
        ]
        : report.warnings;

    let clearedXml = undefined;
    if (type === 'standard') {
        clearedXml = xml.replace('</cbc:ID>', '</cbc:ID>\n    <!-- SIMULATED_STAMP_BY_ZATCA_SIMULATOR -->');
    }

    return {
        success: true,
        status: allWarnings.length > 0
            ? 'WARNING'
            : (type === 'standard' ? 'CLEARED' : 'REPORTED'),
        type,
        invoiceId,
        uuid,
        clearedXml,
        originalXml: xml,
        validationMessages: allWarnings,
        timestamp: new Date().toISOString()
    };
}


