require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

(async () => {
    try {
        const { rows } = await pool.query(`
            SELECT id, title, source_type, original_id, cover_image_path
            FROM books 
            LIMIT 5;
        `);
        console.log("Books found:", JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e.message);
    } finally {
        pool.end();
    }
})();
