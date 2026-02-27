import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ozpizsszauxftudbcftu.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96cGl6c3N6YXV4ZnR1ZGJjZnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMTgxMTcsImV4cCI6MjA4Njg5NDExN30.runabQDAT0pKc0xINCCD0XvCRzTLZ0pZ3e8mVPwbOqQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: access } = await supabase.from('user_module_access').select('*').eq("module_key", "evrak_takip");
    console.log("evrak_takip access rows:", access);

    if (access && access.length > 0) {
        const userIds = access.map(a => a.user_id);
        const { data: profiles } = await supabase.from('profiles').select('id, email, first_name, role').in('id', userIds);
        console.log("Profiles for those users:", profiles);
    }
}

check();
