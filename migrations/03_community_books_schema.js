require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const executeMigration = async () => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        console.log('Creating community_books table...');
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS community_books (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                author VARCHAR(255),
                description TEXT,
                file_path VARCHAR(1000) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query('COMMIT');
        console.log('✅ community_books TABLE SUCCESSFULLY CREATED!');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ MIGRATION FAILED:', e);
    } finally {
        client.release();
        pool.end();
    }
};

executeMigration();
