import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ozpizsszauxftudbcftu.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96cGl6c3N6YXV4ZnR1ZGJjZnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMTgxMTcsImV4cCI6MjA4Njg5NDExN30.runabQDAT0pKc0xINCCD0XvCRzTLZ0pZ3e8mVPwbOqQ';

// The user is logged in as o.fitoz9393@gmail.com
// Since we don't have their JWT directly easily from Node, let's just use the Admin key to query the RLS policies in pg_catalog.

const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, adminKey);

async function check() {
    console.log("Checking RLS on user_module_access...");
    let { data, error } = await supabase.rpc('query_rls', { table_name: 'user_module_access' }).catch(() => ({ data: null, error: null }));
    console.log("RLS Check via RPC (if exists):", data, error);
}

check();
