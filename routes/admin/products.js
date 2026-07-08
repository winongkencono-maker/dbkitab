const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { sendSuccess, sendError } = require('../../utils/response');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

router.use(auth, admin);

router.post('/', async (req, res) => {
    const { title, description, price, stock, weight_grams, cover_image_url, publisher, isbn, category_id, linked_book_id } = req.body;
    try {
        const query = `
            INSERT INTO products (title, description, price, stock, weight_grams, cover_image_url, publisher, isbn, category_id, linked_book_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;
        const values = [title, description, price, stock || 0, weight_grams || 0, cover_image_url, publisher, isbn, category_id, linked_book_id];
        const result = await db.query(query, values);
        sendSuccess(res, result.rows[0], 'Produk berhasil ditambahkan');
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

router.put('/:id', async (req, res) => {
    const { title, description, price, stock, weight_grams, cover_image_url, publisher, isbn, category_id, linked_book_id } = req.body;
    try {
        const query = `
            UPDATE products 
            SET title = COALESCE($1, title),
                description = COALESCE($2, description),
                price = COALESCE($3, price),
                stock = COALESCE($4, stock),
                weight_grams = COALESCE($5, weight_grams),
                cover_image_url = COALESCE($6, cover_image_url),
                publisher = COALESCE($7, publisher),
                isbn = COALESCE($8, isbn),
                category_id = COALESCE($9, category_id),
                linked_book_id = COALESCE($10, linked_book_id)
            WHERE id = $11
            RETURNING *
        `;
        const values = [title, description, price, stock, weight_grams, cover_image_url, publisher, isbn, category_id, linked_book_id, req.params.id];
        const result = await db.query(query, values);
        if (result.rows.length === 0) return sendError(res, 404, 'Produk tidak ditemukan');
        
        sendSuccess(res, result.rows[0], 'Produk diperbarui');
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return sendError(res, 404, 'Produk tidak ditemukan');
        sendSuccess(res, null, 'Produk dihapus');
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

module.exports = router;
