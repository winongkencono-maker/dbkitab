const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { getEmbedding } = require('../utils/embedder');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * @swagger
 * /api/search/semantic:
 *   get:
 *     summary: Semantic Search
 *     description: Cari buku berdasarkan makna atau konteks kalimat menggunakan AI embeddings.
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Kata kunci pencarian
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Jumlah hasil maksimal
 *     responses:
 *       200:
 *         description: Hasil pencarian semantik
 *       400:
 *         description: Parameter 'q' tidak ditemukan
 */
router.get('/semantic', async (req, res) => {
    try {
        const queryText = req.query.q;
        const limit = parseInt(req.query.limit) || 10;
        
        if (!queryText) {
            return sendError(res, 400, 'Parameter "q" diperlukan untuk pencarian');
        }

        console.log(`Generating embedding for query: "${queryText}"`);
        const queryVector = await getEmbedding(queryText);
        
        // Convert to Postgres vector array string format: '[0.1, 0.2, ...]'
        const vectorStr = `[${queryVector.join(',')}]`;

        // Search database using Cosine Distance <=>
        const searchSql = `
            SELECT id, title, title_ltr, author_id, category_id,
                   1 - (embedding <=> $1::vector) AS similarity_score
            FROM books
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> $1::vector
            LIMIT $2
        `;

        const { rows } = await db.query(searchSql, [vectorStr, limit]);

        const mappedResults = rows.map(row => ({
            id: row.id,
            title: row.title,
            title_ltr: row.title_ltr,
            author_id: row.author_id,
            category_id: row.category_id,
            similarity_score: row.similarity_score
        }));

        sendSuccess(res, 200, 'Berhasil menemukan hasil pencarian semantik', mappedResults);

    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Terjadi kesalahan pada server saat melakukan pencarian');
    }
});

module.exports = router;
