const { createClient } = require('@supabase/supabase-js');
const { OdooClient } = require('./src/lib/odoo/client');

const supabaseUrl = 'https://ieokhrbxchllgfcechko.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imllb2tocmJ4Y2hsbGdmY2VjaGtvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTE4MzM1NywiZXhwIjoyMDk0NzU5MzU3fQ.bP_AVNVXBhbQmMxiBJvo0wDB9h6d-BDad8PuVhObPRc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    try {
        const { data: configs, error } = await supabase.from('odoo_config').select('*');
        if (error || !configs || configs.length === 0) {
            console.error('Failed to load Odoo config:', error);
            return;
        }

        const config = configs[0];
        const odoo = new OdooClient({
            odooUrl: config.odoo_url,
            odooDb: config.odoo_db,
            odooUsername: config.odoo_username,
            odooPassword: config.odoo_password
        });

        console.log('Fetching invoice 21 (Credit Note) from Odoo...');
        const mapped = await odoo.getInvoice(21);
        console.log('--- Mapped Invoice Details ---');
        console.log('Invoice ID:', mapped.invoiceId);
        console.log('Type (B2B vs B2C):', mapped.type);
        console.log('Document Type:', mapped.documentType);
        console.log('Original Invoice ID (Linked):', mapped.originalInvoiceId);
        console.log('Credit Reason:', mapped.creditReason);

        console.log('\nFetching invoice 12 (Manual Credit Note) from Odoo...');
        const mapped12 = await odoo.getInvoice(12);
        console.log('--- Mapped Invoice 12 Details ---');
        console.log('Invoice ID:', mapped12.invoiceId);
        console.log('Type (B2B vs B2C):', mapped12.type);
        console.log('Document Type:', mapped12.documentType);
        console.log('Original Invoice ID (Linked):', mapped12.originalInvoiceId);
        console.log('Credit Reason:', mapped12.creditReason);

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
