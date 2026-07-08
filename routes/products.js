const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Mendapatkan daftar produk toko
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Daftar produk berhasil diambil
 */
router.get('/', async (req, res) => {
    try {
        const { search, category_id, limit = 10, offset = 0 } = req.query;
        let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1';
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (p.title ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
        }

        if (category_id) {
            params.push(category_id);
            query += ` AND p.category_id = $${params.length}`;
        }

        query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await db.query(query, params);

        let countQuery = 'SELECT COUNT(*) FROM products p WHERE 1=1';
        const countParams = [];
        if (search) {
            countParams.push(`%${search}%`);
            countQuery += ` AND (p.title ILIKE $${countParams.length} OR p.description ILIKE $${countParams.length})`;
        }
        if (category_id) {
            countParams.push(category_id);
            countQuery += ` AND p.category_id = $${countParams.length}`;
        }

        const countResult = await db.query(countQuery, countParams);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].count),
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Mendapatkan detail produk beserta gambar dan ulasan
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detail produk
 */
router.get('/:id', async (req, res) => {
    try {
        const productResult = await db.query(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.id = $1
        `, [req.params.id]);

        if (productResult.rows.length === 0) {
            return sendError(res, 404, 'Produk tidak ditemukan');
        }

        const product = productResult.rows[0];

        // Get images
        const imagesResult = await db.query('SELECT image_url, is_primary, sort_order FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC', [req.params.id]);
        product.images = imagesResult.rows;

        // Get reviews
        const reviewsResult = await db.query(`
            SELECT pr.rating, pr.comment, pr.created_at, u.name as user_name
            FROM product_reviews pr
            JOIN users u ON pr.user_id = u.id
            WHERE pr.product_id = $1
            ORDER BY pr.created_at DESC
        `, [req.params.id]);
        product.reviews = reviewsResult.rows;

        sendSuccess(res, product);
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

module.exports = router;
