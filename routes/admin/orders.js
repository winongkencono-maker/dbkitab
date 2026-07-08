const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { sendSuccess, sendError } = require('../../utils/response');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

router.use(auth, admin);

router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        let query = 'SELECT * FROM orders';
        const params = [];
        if (status) {
            query += ' WHERE status = $1';
            params.push(status);
        }
        query += ' ORDER BY created_at DESC';
        
        const { rows } = await db.query(query, params);
        sendSuccess(res, rows);
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

router.put('/:id/status', async (req, res) => {
    const { status } = req.body;
    try {
        const result = await db.query('UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [status, req.params.id]);
        if (result.rows.length === 0) return sendError(res, 404, 'Pesanan tidak ditemukan');
        sendSuccess(res, result.rows[0], 'Status diperbarui');
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

module.exports = router;
