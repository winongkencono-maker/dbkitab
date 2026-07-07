require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const generateTokens = (user) => {
    const payload = { id: user.id, email: user.email, role: user.role };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'refresh_secret123', { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

(async () => {
    try {
        const password = 'aa123';
        const email = 'tesss@a.a' + Date.now();
        const full_name = 'string';

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        await pool.query('BEGIN');
        
        const insertUserText = `
            INSERT INTO users(email, password_hash, full_name, auth_provider) 
            VALUES($1, $2, $3, 'email') RETURNING id, email, full_name, role
        `;
        const userResult = await pool.query(insertUserText, [email, password_hash, full_name]);
        const newUser = userResult.rows[0];

        await pool.query('INSERT INTO user_profiles(user_id) VALUES($1)', [newUser.id]);
        
        await pool.query('COMMIT');

        const tokens = generateTokens(newUser);
        
        // Simulating undefined req.ip
        const reqIp = undefined;
        
        await pool.query(
            'INSERT INTO user_sessions(user_id, refresh_token, ip_address) VALUES($1, $2, $3)',
            [newUser.id, tokens.refreshToken, reqIp || null]
        );

        console.log('SUCCESS!');
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error('ERROR OCCURRED:', e.message);
        console.error(e.stack);
    } finally {
        pool.end();
    }
})();
