const { Client } = require('pg');

const client = new Client({
    host: '43.134.134.169',
    port: 5432,
    user: 'daftarkitab',
    password: 'postgres',
    database: 'daftarkitab'
});

const sql = `
-- Membuat tabel Galeri Gambar Produk
CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    image_url VARCHAR(255) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function run() {
    await client.connect();
    
    try {
        console.log('Creating product_images table...');
        await client.query(sql);
        console.log('Table product_images created successfully!');
    } catch (err) {
        console.error('Error during migration:', err.message);
    } finally {
        await client.end();
    }
}

run();
