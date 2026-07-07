const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { getEmbedding } = require('../utils/embedder');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * @swagger
 * /api/search/semantic:
 *   get:
 *     summary: Semantic & Keyword Search (Hybrid)
 *     description: Cari buku berdasarkan judul, kata kunci, atau makna kalimat (Hybrid Search).
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

        // 1. TEXT SEARCH (Prioritas Utama untuk Judul/Keyword persis)
        const textSearchSql = `
            SELECT id, title, title_ltr, author_id, category_id,
                   1.0 AS similarity_score, 'text_match' AS match_type
            FROM books
            WHERE title ILIKE $1 OR title_ltr ILIKE $1 OR search_keywords_ltr ILIKE $1
            LIMIT $2
        `;
        const textPattern = \`%\${queryText}%\`;
        const textResults = await db.query(textSearchSql, [textPattern, limit]);

        // 2. SEMANTIC SEARCH (Menggunakan AI Vector)
        console.log(`Generating embedding for query: "${queryText}"`);
        const queryVector = await getEmbedding(queryText);
        const vectorStr = `[${queryVector.join(',')}]`;

        const semanticSearchSql = `
            SELECT id, title, title_ltr, author_id, category_id,
                   1 - (embedding <=> $1::vector) AS similarity_score, 'semantic_match' AS match_type
            FROM books
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> $1::vector
            LIMIT $2
        `;
        const semanticResults = await db.query(semanticSearchSql, [vectorStr, limit]);

        // 3. GABUNGKAN & HILANGKAN DUPLIKAT
        const combinedResults = [...textResults.rows];
        const existingIds = new Set(combinedResults.map(r => r.id));

        for (const row of semanticResults.rows) {
            if (!existingIds.has(row.id)) {
                combinedResults.push(row);
                existingIds.add(row.id);
            }
        }

        // Urutkan berdasarkan similarity_score dan limit hasilnya
        combinedResults.sort((a, b) => b.similarity_score - a.similarity_score);
        const finalResults = combinedResults.slice(0, limit);

        sendSuccess(res, 200, 'Berhasil menemukan hasil pencarian', finalResults);

    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Terjadi kesalahan pada server saat melakukan pencarian');
    }
});

module.exports = router;
