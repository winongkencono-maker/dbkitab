const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const auth = require('../middleware/auth');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrasi pelanggan baru
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Berhasil registrasi
 */
router.post('/register', async (req, res) => {
    const { name, email, password, phone } = req.body;
    
    if (!name || !email || !password) {
        return sendError(res, 400, 'Nama, email, dan password wajib diisi.');
    }

    try {
        const checkUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (checkUser.rows.length > 0) {
            return sendError(res, 400, 'Email sudah terdaftar.');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await db.query(
            'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, full_name, email, role',
            [name, email, hashedPassword]
        );

        if (phone) {
            await db.query('INSERT INTO user_profiles (user_id, phone_number) VALUES ($1, $2)', [newUser.rows[0].id, phone]);
        }

        res.status(201).json({
            success: true,
            message: 'Registrasi berhasil',
            data: newUser.rows[0]
        });

    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login pengguna
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
 *         description: Berhasil login
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return sendError(res, 400, 'Email dan password wajib diisi.');
    }

    try {
        const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = userResult.rows[0];

        if (!user) {
            return sendError(res, 401, 'Email atau password salah.');
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return sendError(res, 401, 'Email atau password salah.');
        }

        const payload = {
            id: user.id,
            email: user.email,
            role: user.role
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'rahasia123', { expiresIn: '7d' });

        res.json({
            success: true,
            message: 'Login berhasil',
            data: {
                token,
                user: {
                    id: user.id,
                    name: user.full_name,
                    email: user.email,
                    role: user.role
                }
            }
        });
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Mengambil profil pengguna saat ini
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data pengguna
 */
router.get('/me', auth, async (req, res) => {
    try {
        const userResult = await db.query(`
            SELECT u.id, u.full_name, u.email, u.role, u.created_at, p.phone_number as phone
            FROM users u LEFT JOIN user_profiles p ON u.id = p.user_id
            WHERE u.id = $1
        `, [req.user.id]);
        
        if (userResult.rows.length === 0) {
            return sendError(res, 404, 'User tidak ditemukan.');
        }

        sendSuccess(res, userResult.rows[0]);
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

module.exports = router;
