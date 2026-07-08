require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

(async () => {
    try {
        const { rows } = await pool.query(`
            SELECT *
            FROM books 
            WHERE source_type = 'WAQFEYA'
            LIMIT 1;
        `);
        console.log("Waqfeya Book details:", JSON.stringify(rows[0], null, 2));
    } catch (e) {
        console.error(e.message);
    } finally {
        pool.end();
    }
})();
