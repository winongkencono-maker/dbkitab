require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

(async () => {
    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash('Tes123', salt);
        const email = 'tess' + Date.now() + '@tes.com';
        const full_name = 'tes';

        await pool.query('BEGIN');
        
        const insertUserText = `
            INSERT INTO users(email, password_hash, full_name, auth_provider) 
            VALUES($1, $2, $3, 'email') RETURNING id, email, full_name, role
        `;
        const userResult = await pool.query(insertUserText, [email, password_hash, full_name]);
        const newUser = userResult.rows[0];

        await pool.query('INSERT INTO user_profiles(user_id) VALUES($1)', [newUser.id]);
        
        await pool.query('COMMIT');
        console.log('Success!', newUser);
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error('ERROR:', e.message);
        console.error(e);
    } finally {
        pool.end();
    }
})();
