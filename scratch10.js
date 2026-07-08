require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

(async () => {
    try {
        let { rows } = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'subscriptions';
        `);
        console.log("subscriptions schema:", rows);

        ({ rows } = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'transactions';
        `));
        console.log("transactions schema:", rows);
    } catch (e) {
        console.error(e.message);
    } finally {
        pool.end();
    }
})();
