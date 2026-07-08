require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

(async () => {
    try {
        const query = `
            SELECT b.id, b.title, b.source_type, bs.pdf_url, bs.external_download_url
            FROM books b
            LEFT JOIN book_sources bs ON b.id = bs.book_id
            WHERE b.source_type = 'WAQFEYA'
            LIMIT 1;
        `;
        const { rows } = await pool.query(query);
        const book = rows[0];
        console.log("Book from DB:", JSON.stringify(book, null, 2));
        
        const urlToTest = book.pdf_url || book.external_download_url;
        
        if (urlToTest) {
            console.log(`\nTesting URL: ${urlToTest}`);
            try {
                const response = await axios.head(urlToTest);
                console.log(`Success! Status: ${response.status}`);
                console.log(`Content-Type: ${response.headers['content-type']}`);
                console.log(`Content-Length: ${response.headers['content-length']}`);
            } catch (err) {
                console.error(`Error downloading: ${err.message}`);
                if (err.response) {
                    console.error(`Status code: ${err.response.status}`);
                }
            }
        } else {
            console.log("\nNo URL found in pdf_url or external_download_url!");
        }
        
    } catch (e) {
        console.error(e.message);
    } finally {
        pool.end();
    }
})();
