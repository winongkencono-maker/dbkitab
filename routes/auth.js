const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper function to generate JWT
const generateTokens = (user) => {
    const payload = { id: user.id, email: user.email, role: user.role };
    
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'secret123', {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    });
    
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'refresh_secret123', {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });
    
    return { accessToken, refreshToken };
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - full_name
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               full_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input or email already exists
 */
router.post('/register', async (req, res) => {
    const { email, password, full_name } = req.body;

    if (!email || !password || !full_name) {
        return sendError(res, 400, 'Email, password, dan nama lengkap wajib diisi');
    }

    try {
        // Check if user exists
        const userCheck = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return sendError(res, 400, 'Email ini sudah terdaftar');
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Insert new user & profile in a transaction
        await db.query('BEGIN');
        
        const insertUserText = `
            INSERT INTO users(email, password_hash, full_name, auth_provider) 
            VALUES($1, $2, $3, 'email') RETURNING id, email, full_name, role
        `;
        const userResult = await db.query(insertUserText, [email, password_hash, full_name]);
        const newUser = userResult.rows[0];

        // Create empty profile
        await db.query('INSERT INTO user_profiles(user_id) VALUES($1)', [newUser.id]);
        
        await db.query('COMMIT');

        // Optional: Generate token immediately (auto-login after register)
        const tokens = generateTokens(newUser);

        // Store refresh token
        await db.query(
            'INSERT INTO user_sessions(user_id, refresh_token, ip_address) VALUES($1, $2, $3)',
            [newUser.id, tokens.refreshToken, req.ip || null]
        );

        sendSuccess(res, 201, 'Pendaftaran berhasil', {
            user: { id: newUser.id, email: newUser.email, full_name: newUser.full_name },
            tokens
        });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Registration error:', err);
        sendError(res, 500, 'Terjadi kesalahan saat mendaftar');
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user with email & password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid email or password
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return sendError(res, 400, 'Email dan password wajib diisi');
    }

    try {
        const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = userResult.rows[0];

        if (!user) {
            return sendError(res, 401, 'Email atau password salah');
        }

        if (user.auth_provider !== 'email' || !user.password_hash) {
            return sendError(res, 401, 'Silakan login menggunakan Google');
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return sendError(res, 401, 'Email atau password salah');
        }

        const tokens = generateTokens(user);

        await db.query(
            'INSERT INTO user_sessions(user_id, refresh_token, ip_address) VALUES($1, $2, $3)',
            [user.id, tokens.refreshToken, req.ip || null]
        );

        sendSuccess(res, 200, 'Login berhasil', {
            user: { id: user.id, email: user.email, full_name: user.full_name, avatar_url: user.avatar_url },
            tokens
        });

    } catch (err) {
        console.error('Login error:', err);
        sendError(res, 500, 'Terjadi kesalahan saat login');
    }
});

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Login or Register via Google ID Token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Authenticated successfully
 */
router.post('/google', async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return sendError(res, 400, 'Token ID Google diperlukan');
    }

    try {
        // Validate token with Google
        const ticket = await googleClient.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID, 
        });
        const payload = ticket.getPayload();
        
        const email = payload['email'];
        const full_name = payload['name'];
        const avatar_url = payload['picture'];
        const provider_id = payload['sub'];

        // Check if user exists
        const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        let user = userResult.rows[0];

        if (!user) {
            // Create new Google User
            await db.query('BEGIN');
            
            const insertUserText = `
                INSERT INTO users(email, full_name, avatar_url, auth_provider, provider_id, is_email_verified) 
                VALUES($1, $2, $3, 'google', $4, true) RETURNING id, email, full_name, role, avatar_url
            `;
            const newUserResult = await db.query(insertUserText, [email, full_name, avatar_url, provider_id]);
            user = newUserResult.rows[0];

            await db.query('INSERT INTO user_profiles(user_id) VALUES($1)', [user.id]);
            await db.query('COMMIT');
        } else {
            // Optionally update avatar if changed
            if (user.avatar_url !== avatar_url) {
                await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatar_url, user.id]);
            }
        }

        const tokens = generateTokens(user);

        await db.query(
            'INSERT INTO user_sessions(user_id, refresh_token, ip_address) VALUES($1, $2, $3)',
            [user.id, tokens.refreshToken, req.ip || null]
        );

        sendSuccess(res, 200, 'Google Login berhasil', {
            user: { id: user.id, email: user.email, full_name: user.full_name, avatar_url: user.avatar_url },
            tokens
        });

    } catch (err) {
        console.error('Google Auth error:', err);
        sendError(res, 401, 'Token Google tidak valid atau kadaluarsa');
    }
});

module.exports = router;
