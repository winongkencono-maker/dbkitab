const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current logged in user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const sql = `
            SELECT 
                u.id, u.email, u.full_name, u.avatar_url, u.auth_provider, u.is_email_verified,
                p.phone_number, p.bio, p.date_of_birth, p.gender, p.location, p.app_language, p.app_theme
            FROM users u
            LEFT JOIN user_profiles p ON u.id = p.user_id
            WHERE u.id = $1
        `;
        
        const { rows } = await db.query(sql, [userId]);
        
        if (rows.length === 0) {
            return sendError(res, 404, 'Pengguna tidak ditemukan');
        }

        // Check active subscription
        const subSql = `
            SELECT plan_id, status, current_period_end 
            FROM subscriptions 
            WHERE user_id = $1 AND status = 'active' AND current_period_end > CURRENT_TIMESTAMP
            ORDER BY created_at DESC LIMIT 1
        `;
        const subRows = await db.query(subSql, [userId]);
        
        const userData = rows[0];
        userData.subscription = subRows.rows.length > 0 ? subRows.rows[0] : null;

        sendSuccess(res, 200, 'Berhasil mengambil profil', userData);

    } catch (err) {
        console.error('Get profile error:', err);
        sendError(res, 500, 'Terjadi kesalahan saat mengambil profil');
    }
});

/**
 * @swagger
 * /api/users/me/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *               phone_number:
 *                 type: string
 *               bio:
 *                 type: string
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: [male, female]
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/me/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { full_name, phone_number, bio, date_of_birth, gender, location } = req.body;

        await db.query('BEGIN');

        if (full_name) {
            await db.query('UPDATE users SET full_name = $1 WHERE id = $2', [full_name, userId]);
        }

        const updateProfileSql = `
            UPDATE user_profiles 
            SET 
                phone_number = COALESCE($1, phone_number),
                bio = COALESCE($2, bio),
                date_of_birth = COALESCE($3, date_of_birth),
                gender = COALESCE($4, gender),
                location = COALESCE($5, location),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $6
        `;
        
        await db.query(updateProfileSql, [phone_number, bio, date_of_birth, gender, location, userId]);
        
        await db.query('COMMIT');
        
        sendSuccess(res, 200, 'Profil berhasil diperbarui');

    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Update profile error:', err);
        sendError(res, 500, 'Terjadi kesalahan saat memperbarui profil');
    }
});

/**
 * @swagger
 * /api/users/me/settings:
 *   put:
 *     summary: Update app settings (theme, language)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               app_language:
 *                 type: string
 *               app_theme:
 *                 type: string
 *                 enum: [light, dark, system]
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.put('/me/settings', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { app_language, app_theme } = req.body;

        const updateProfileSql = `
            UPDATE user_profiles 
            SET 
                app_language = COALESCE($1, app_language),
                app_theme = COALESCE($2, app_theme),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $3
        `;
        
        await db.query(updateProfileSql, [app_language, app_theme, userId]);
        
        sendSuccess(res, 200, 'Pengaturan berhasil diperbarui');

    } catch (err) {
        console.error('Update settings error:', err);
        sendError(res, 500, 'Terjadi kesalahan saat memperbarui pengaturan');
    }
});

module.exports = router;
