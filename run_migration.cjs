const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
    connectionString: 'postgresql://postgres.ozpizsszauxftudbcftu:Ofitoz19932025*@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'
});

const sql = fs.readFileSync('supabase/migrations/20240304000001_exam_agreement_templates.sql', 'utf8');

client.connect().then(() => {
    return client.query(sql);
}).then(() => {
    console.log("Migration executed successfully!");
    return client.end();
}).catch(console.error);
