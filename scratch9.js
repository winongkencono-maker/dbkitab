require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

(async () => {
    try {
        const { rows } = await pool.query(`
            SELECT * 
            FROM book_sources 
            LIMIT 5;
        `);
        console.log("Book sources:", JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e.message);
    } finally {
        pool.end();
    }
})();
