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

        const uid = await odoo.authenticate();
        console.log('Authenticated UID:', uid);

        // Fetch model fields to see if debit_origin_id and reversed_entry_id exist
        const fields = await odoo.execute('account.move', 'fields_get', [[], ['type']]);
        console.log('--- Move Fields List ---');
        console.log('reversed_entry_id exists:', 'reversed_entry_id' in fields);
        console.log('debit_origin_id exists:', 'debit_origin_id' in fields);
        console.log('invoice_origin exists:', 'invoice_origin' in fields);
        console.log('ref exists:', 'ref' in fields);
        console.log('x_zatca_document_type exists:', 'x_zatca_document_type' in fields);

        // Let's search for the last 5 moves to see their move_type and values
        const lastMoves = await odoo.execute('account.move', 'search_read', [
            [],
            ['id', 'name', 'move_type', 'reversed_entry_id', 'ref']
        ], { limit: 10 });
        console.log('--- Last 10 Moves in Odoo ---');
        console.log(JSON.stringify(lastMoves, null, 2));

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
