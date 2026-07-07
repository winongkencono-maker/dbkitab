const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * @swagger
 * /api/authors:
 *   get:
 *     summary: List Authors
 *     description: Mendapatkan daftar pengarang kitab. Mendukung fitur paginasi dan lazy loading.
 *     tags: [Authors]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Nomor halaman
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Jumlah data per halaman
 *     responses:
 *       200:
 *         description: Berhasil
 */
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const { rows } = await db.query(
            'SELECT id, name, name_ltr, death_year_hijri FROM authors ORDER BY name ASC LIMIT $1 OFFSET $2',
            [limit, offset]
        );
        
        const countResult = await db.query('SELECT COUNT(*) FROM authors');
        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limit);

        const meta = {
            total,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        };

        sendSuccess(res, 200, 'Berhasil mendapatkan daftar pengarang', rows, meta);
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Terjadi kesalahan pada server');
    }
});

/**
 * @swagger
 * /api/authors/{id}:
 *   get:
 *     summary: Get Author Details
 *     description: Mendapatkan profil lengkap seorang pengarang.
 *     tags: [Authors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID pengarang
 *     responses:
 *       200:
 *         description: Berhasil
 *       404:
 *         description: Pengarang tidak ditemukan
 */
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT id, name, name_ltr, biography, biography_ltr, madzhab, era, death_year_hijri FROM authors WHERE id = $1', [req.params.id]);
        
        if (rows.length === 0) {
            return sendError(res, 404, 'Pengarang tidak ditemukan');
        }
        
        sendSuccess(res, 200, 'Berhasil mengambil detail pengarang', rows[0]);
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Terjadi kesalahan pada server');
    }
});

module.exports = router;
