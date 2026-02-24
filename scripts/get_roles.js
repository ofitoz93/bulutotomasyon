import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_APP_URL';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_APP_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('profiles').select('id, first_name, role').limit(5);
    if (error) console.error(error);
    else console.log(data);
}
check();
