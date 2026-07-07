const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: List Categories
 *     description: Mendapatkan daftar semua kategori kitab.
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Berhasil
 */
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT id, name, name_ltr, general_category_name, parent_id FROM categories ORDER BY name ASC');
        sendSuccess(res, 200, 'Berhasil mendapatkan daftar kategori', rows);
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Terjadi kesalahan pada server');
    }
});

module.exports = router;
