const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT bs.pdf_url, bs.external_download_url FROM book_sources bs WHERE bs.book_id = '5363bc07-5c5f-4dc1-b936-11edc7d0db3a'").then(res => { console.log(res.rows); process.exit(); });
