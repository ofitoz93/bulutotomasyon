import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ozpizsszauxftudbcftu.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96cGl6c3N6YXV4ZnR1ZGJjZnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMTgxMTcsImV4cCI6MjA4Njg5NDExN30.runabQDAT0pKc0xINCCD0XvCRzTLZ0pZ3e8mVPwbOqQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: docs } = await supabase.from('documents')
        .select('title, created_at')
        .like('title', 'DBG|%')
        .order('created_at', { ascending: false })
        .limit(5);
    console.log("Telemetry results:", docs);
}

check();
