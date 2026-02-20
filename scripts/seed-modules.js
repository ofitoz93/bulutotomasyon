
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ozpizsszauxftudbcftu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96cGl6c3N6YXV4ZnR1ZGJjZnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMTgxMTcsImV4cCI6MjA4Njg5NDExN30.runabQDAT0pKc0xINCCD0XvCRzTLZ0pZ3e8mVPwbOqQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log('Seeding modules...');
    const { error } = await supabase.from('modules').upsert([
        { key: 'evrak_takip', name: 'Evrak Takip', category: 'İdari İşler', description: 'Evraklarınızı dijital ortamda saklayın ve yönetin.' },
        { key: 'ekipman_takip', name: 'Ekipman Takip', category: 'Operasyon', description: 'Ekipmanlarınızın konumunu ve bakım durumunu takip edin.' }
    ], { onConflict: 'key' });

    if (error) {
        console.error('Error seeding modules:', error);
    } else {
        console.log('Modules seeded successfully!');
    }
}

seed();
