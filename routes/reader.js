const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * /api/reader/library:
 *   get:
 *     summary: Get all books in user's library
 *     tags: [Reader]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of books in library
 */
router.get('/library', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const sql = `
            SELECT 
                ul.id, ul.book_id, ul.reading_status, ul.is_downloaded_locally, ul.created_at as added_at,
                rp.last_page_number, rp.progress_percentage,
                b.title, b.author
            FROM user_library ul
            LEFT JOIN reading_progress rp ON ul.book_id = rp.book_id AND rp.user_id = $1
            LEFT JOIN books b ON ul.book_id = b.id
            WHERE ul.user_id = $1
            ORDER BY ul.created_at DESC
        `;
        const { rows } = await db.query(sql, [userId]);
        sendSuccess(res, 200, 'Berhasil mengambil daftar library', rows);
    } catch (err) {
        console.error('Library GET error:', err);
        sendError(res, 500, 'Terjadi kesalahan sistem');
    }
});

/**
 * @swagger
 * /api/reader/library/{bookId}:
 *   post:
 *     summary: Add book to library
 *     tags: [Reader]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Book added to library
 */
router.post('/library/:bookId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { bookId } = req.params;
        
        // Use UPSERT to avoid duplicates
        const sql = `
            INSERT INTO user_library (user_id, book_id, reading_status)
            VALUES ($1, $2, 'want_to_read')
            ON CONFLICT (user_id, book_id) DO NOTHING
            RETURNING *
        `;
        const { rows } = await db.query(sql, [userId, bookId]);
        
        sendSuccess(res, 201, 'Berhasil menyimpan kitab ke library', rows[0] || { message: 'Kitab sudah ada di library' });
    } catch (err) {
        console.error('Library POST error:', err);
        sendError(res, 500, 'Terjadi kesalahan sistem');
    }
});

/**
 * @swagger
 * /api/reader/library/{bookId}:
 *   delete:
 *     summary: Remove book from library
 *     tags: [Reader]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Book removed
 */
router.delete('/library/:bookId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { bookId } = req.params;
        await db.query('DELETE FROM user_library WHERE user_id = $1 AND book_id = $2', [userId, bookId]);
        sendSuccess(res, 200, 'Berhasil menghapus kitab dari library');
    } catch (err) {
        console.error('Library DELETE error:', err);
        sendError(res, 500, 'Terjadi kesalahan sistem');
    }
});

/**
 * @swagger
 * /api/reader/progress/{bookId}:
 *   put:
 *     summary: Update reading progress
 *     tags: [Reader]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               last_page_number:
 *                 type: integer
 *               last_location_identifier:
 *                 type: string
 *               progress_percentage:
 *                 type: number
 *     responses:
 *       200:
 *         description: Progress updated
 */
router.put('/progress/:bookId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { bookId } = req.params;
        const { last_page_number, last_location_identifier, progress_percentage } = req.body;

        const sql = `
            INSERT INTO reading_progress (user_id, book_id, last_page_number, last_location_identifier, progress_percentage)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, book_id) DO UPDATE SET
                last_page_number = EXCLUDED.last_page_number,
                last_location_identifier = EXCLUDED.last_location_identifier,
                progress_percentage = EXCLUDED.progress_percentage,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        const { rows } = await db.query(sql, [userId, bookId, last_page_number, last_location_identifier, progress_percentage]);
        
        // Update reading status in library if > 0
        if (progress_percentage > 0) {
            const status = progress_percentage >= 100 ? 'finished' : 'reading';
            await db.query('UPDATE user_library SET reading_status = $1 WHERE user_id = $2 AND book_id = $3', [status, userId, bookId]);
        }

        sendSuccess(res, 200, 'Progress berhasil diperbarui', rows[0]);
    } catch (err) {
        console.error('Progress PUT error:', err);
        sendError(res, 500, 'Terjadi kesalahan sistem');
    }
});

/**
 * @swagger
 * /api/reader/progress/{bookId}:
 *   get:
 *     summary: Get reading progress
 *     tags: [Reader]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reading progress details
 */
router.get('/progress/:bookId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { bookId } = req.params;
        const { rows } = await db.query('SELECT * FROM reading_progress WHERE user_id = $1 AND book_id = $2', [userId, bookId]);
        sendSuccess(res, 200, 'Berhasil mengambil progress', rows[0] || {});
    } catch (err) {
        console.error('Progress GET error:', err);
        sendError(res, 500, 'Terjadi kesalahan sistem');
    }
});

/**
 * @swagger
 * /api/reader/bookmarks/{bookId}:
 *   get:
 *     summary: Get bookmarks for a book
 *     tags: [Reader]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of bookmarks
 */
router.get('/bookmarks/:bookId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { bookId } = req.params;
        const { rows } = await db.query('SELECT * FROM bookmarks WHERE user_id = $1 AND book_id = $2 ORDER BY page_number ASC', [userId, bookId]);
        sendSuccess(res, 200, 'Berhasil mengambil bookmarks', rows);
    } catch (err) {
        console.error('Bookmarks GET error:', err);
        sendError(res, 500, 'Terjadi kesalahan sistem');
    }
});

/**
 * @swagger
 * /api/reader/bookmarks/{bookId}:
 *   post:
 *     summary: Add bookmark
 *     tags: [Reader]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               page_number:
 *                 type: integer
 *               location_identifier:
 *                 type: string
 *               bookmark_title:
 *                 type: string
 *     responses:
 *       201:
 *         description: Bookmark added
 */
router.post('/bookmarks/:bookId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { bookId } = req.params;
        const { page_number, location_identifier, bookmark_title } = req.body;
        
        const sql = `
            INSERT INTO bookmarks (user_id, book_id, page_number, location_identifier, bookmark_title)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        const { rows } = await db.query(sql, [userId, bookId, page_number, location_identifier, bookmark_title]);
        sendSuccess(res, 201, 'Berhasil menambahkan bookmark', rows[0]);
    } catch (err) {
        console.error('Bookmarks POST error:', err);
        sendError(res, 500, 'Terjadi kesalahan sistem');
    }
});

/**
 * @swagger
 * /api/reader/bookmarks/{id}:
 *   delete:
 *     summary: Delete a bookmark
 *     tags: [Reader]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Bookmark deleted
 */
router.delete('/bookmarks/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await db.query('DELETE FROM bookmarks WHERE id = $1 AND user_id = $2', [id, userId]);
        sendSuccess(res, 200, 'Berhasil menghapus bookmark');
    } catch (err) {
        console.error('Bookmarks DELETE error:', err);
        sendError(res, 500, 'Terjadi kesalahan sistem');
    }
});

/**
 * @swagger
 * /api/reader/highlights/{bookId}:
 *   get:
 *     summary: Get highlights for a book
 *     tags: [Reader]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of highlights
 */
router.get('/highlights/:bookId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { bookId } = req.params;
        const { rows } = await db.query('SELECT * FROM highlights WHERE user_id = $1 AND book_id = $2', [userId, bookId]);
        sendSuccess(res, 200, 'Berhasil mengambil highlights', rows);
    } catch (err) {
        console.error('Highlights GET error:', err);
        sendError(res, 500, 'Terjadi kesalahan sistem');
    }
});

/**
 * @swagger
 * /api/reader/highlights/{bookId}:
 *   post:
 *     summary: Add highlight
 *     tags: [Reader]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               highlighted_text:
 *                 type: string
 *               color_hex:
 *                 type: string
 *               start_position:
 *                 type: string
 *               end_position:
 *                 type: string
 *               page_number:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Highlight added
 */
router.post('/highlights/:bookId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { bookId } = req.params;
        const { highlighted_text, color_hex, start_position, end_position, page_number } = req.body;
        
        const sql = `
            INSERT INTO highlights (user_id, book_id, highlighted_text, color_hex, start_position, end_position, page_number)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const { rows } = await db.query(sql, [userId, bookId, highlighted_text, color_hex, start_position, end_position, page_number]);
        sendSuccess(res, 201, 'Berhasil menambahkan highlight', rows[0]);
    } catch (err) {
        console.error('Highlights POST error:', err);
        sendError(res, 500, 'Terjadi kesalahan sistem');
    }
});

/**
 * @swagger
 * /api/reader/highlights/{id}:
 *   delete:
 *     summary: Delete a highlight
 *     tags: [Reader]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Highlight deleted
 */
router.delete('/highlights/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await db.query('DELETE FROM highlights WHERE id = $1 AND user_id = $2', [id, userId]);
        sendSuccess(res, 200, 'Berhasil menghapus highlight');
    } catch (err) {
        console.error('Highlights DELETE error:', err);
        sendError(res, 500, 'Terjadi kesalahan sistem');
    }
});

module.exports = router;
