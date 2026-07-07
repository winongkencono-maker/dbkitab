const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * @swagger
 * /api/books:
 *   get:
 *     summary: List Books
 *     description: Mendapatkan daftar kitab dengan fitur paginasi (cocok untuk lazy loading) dan filter.
 *     tags: [Books]
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
 *         description: Jumlah kitab per halaman
 *       - in: query
 *         name: author_id
 *         schema:
 *           type: string
 *         description: Filter berdasarkan ID pengarang
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: string
 *         description: Filter berdasarkan ID kategori
 *     responses:
 *       200:
 *         description: Berhasil mendapatkan daftar kitab
 */
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        let query = 'SELECT id, title, title_ltr, author_id, category_id, pages_count, volumes_count, rating FROM books WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (req.query.author_id) {
            query += ` AND author_id = $${paramIndex++}`;
            params.push(req.query.author_id);
        }

        if (req.query.category_id) {
            query += ` AND category_id = $${paramIndex++}`;
            params.push(req.query.category_id);
        }

        query += ` ORDER BY title ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const { rows } = await db.query(query, params);
        
        // Count total for pagination
        let countQuery = 'SELECT COUNT(*) FROM books WHERE 1=1';
        const countParams = [];
        let cParamIndex = 1;
        
        if (req.query.author_id) {
            countQuery += ` AND author_id = $${cParamIndex++}`;
            countParams.push(req.query.author_id);
        }
        if (req.query.category_id) {
            countQuery += ` AND category_id = $${cParamIndex++}`;
            countParams.push(req.query.category_id);
        }

        const countResult = await db.query(countQuery, countParams);
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

        sendSuccess(res, 200, 'Berhasil mendapatkan daftar kitab', rows, meta);
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Terjadi kesalahan pada server');
    }
});

const axios = require('axios');
const SHAMELA_BASE_URL = 'https://winongkencono-samela.hf.space';

/**
 * @swagger
 * /api/books/shamela:
 *   get:
 *     summary: Search Shamela Books
 *     tags: [Books (Shamela)]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Keyword pencarian
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Berhasil mendapatkan buku dari Shamela
 */
router.get('/shamela', async (req, res) => {
    try {
        const response = await axios.get(`${SHAMELA_BASE_URL}/api/books`, { params: req.query });
        sendSuccess(res, 200, 'Berhasil dari Shamela', response.data);
    } catch (err) {
        console.error('Shamela Search Error:', err.message);
        sendError(res, 500, 'Gagal terhubung ke Shamela API');
    }
});

/**
 * @swagger
 * /api/books/shamela/{id}:
 *   get:
 *     summary: Get Shamela Book Detail & Auto-Sync
 *     tags: [Books (Shamela)]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detail kitab Shamela
 */
router.get('/shamela/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.get(`${SHAMELA_BASE_URL}/api/books/${id}`);
        const bookData = response.data;
        
        if (!bookData) {
            return sendError(res, 404, 'Kitab Shamela tidak ditemukan');
        }

        // Auto-sync ke tabel lokal (Stub)
        const localBookId = `shamela-${id}`;
        const title = bookData.title || `Kitab Shamela ${id}`;
        const authorId = bookData.author?.id ? `shamela-author-${bookData.author.id}` : null;
        
        await db.query(`
            INSERT INTO books (id, title, source_type, original_id, pages_count, author_id)
            VALUES ($1, $2, 'shamela', $3, $4, $5)
            ON CONFLICT (id) DO NOTHING
        `, [localBookId, title, id, bookData.pages_count || null, authorId]);

        sendSuccess(res, 200, 'Berhasil dari Shamela', bookData);
    } catch (err) {
        console.error('Shamela Detail Error:', err.message);
        sendError(res, 500, 'Gagal terhubung ke Shamela API');
    }
});

/**
 * @swagger
 * /api/books/shamela/{id}/pages:
 *   get:
 *     summary: Get Shamela Book Pages
 *     tags: [Books (Shamela)]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Halaman dari Shamela
 */
router.get('/shamela/:id/pages', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.get(`${SHAMELA_BASE_URL}/api/books/${id}/pages`, { params: req.query });
        sendSuccess(res, 200, 'Berhasil dari Shamela', response.data);
    } catch (err) {
        console.error('Shamela Pages Error:', err.message);
        sendError(res, 500, 'Gagal terhubung ke Shamela API');
    }
});

/**
 * @swagger
 * /api/books/{id}:
 *   get:
 *     summary: Get Book Details
 *     description: Mendapatkan detail lengkap dari sebuah kitab.
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID kitab
 *     responses:
 *       200:
 *         description: Berhasil
 *       404:
 *         description: Kitab tidak ditemukan
 */
router.get('/:id', async (req, res) => {
    try {
        const query = `
            SELECT b.id, b.title, b.title_ltr, b.author_id, b.category_id, b.pages_count, 
                   b.volumes_count, b.rating, b.description, b.description_ltr, b.main_topics, 
                   b.cover_image_path, b.source_type, b.original_id,
                   bs.pdf_url, bs.external_download_url, bs.api_base_url
            FROM books b
            LEFT JOIN book_sources bs ON b.id = bs.book_id
            WHERE b.id = $1
        `;
        const { rows } = await db.query(query, [req.params.id]);
        
        if (rows.length === 0) {
            return sendError(res, 404, 'Kitab tidak ditemukan');
        }
        
        sendSuccess(res, 200, 'Berhasil mengambil detail kitab', rows[0]);
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Terjadi kesalahan pada server');
    }
});

module.exports = router;
