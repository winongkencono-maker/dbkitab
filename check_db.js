const { Client } = require('pg');

const client = new Client({
    host: '43.134.134.169',
    port: 5432,
    user: 'daftarkitab',
    password: 'postgres',
    database: 'daftarkitab'
});

async function run() {
    await client.connect();
    
    try {
        const res = await client.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name IN ('authors', 'categories', 'books')
            ORDER BY table_name, ordinal_position;
        `);
        
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
