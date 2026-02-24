const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres.ozpizsszauxftudbcftu:Ofitoz19932025*@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'
});

client.connect().then(() => {
    return client.query("SELECT event_object_table, trigger_name, action_statement FROM information_schema.triggers WHERE event_object_table = 'profiles';");
}).then(r => {
    console.log(r.rows);
    return client.end();
}).catch(console.error);
