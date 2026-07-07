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
        const textPattern = `%${queryText}%`;
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

/**
 * @swagger
 * /api/search/title:
 *   get:
 *     summary: Smart Title Search (Fast Keyword Match)
 *     description: Pencarian super cepat khusus untuk judul kitab. Mendukung kecocokan kata parsial dan mengabaikan urutan kata.
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Kata kunci judul (contoh "fiqih sunnah")
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Jumlah hasil maksimal
 *     responses:
 *       200:
 *         description: Hasil pencarian judul kitab
 *       400:
 *         description: Parameter 'q' tidak ditemukan
 */
router.get('/title', async (req, res) => {
    try {
        const queryText = req.query.q;
        const limit = parseInt(req.query.limit) || 10;
        
        if (!queryText) {
            return sendError(res, 400, 'Parameter "q" diperlukan untuk pencarian');
        }

        // Pisahkan query berdasarkan spasi (misal: "ianat thalibin" -> ["ianat", "thalibin"])
        const words = queryText.trim().split(/\s+/).filter(w => w.length > 0);
        
        if (words.length === 0) {
            return sendSuccess(res, 200, 'Berhasil menemukan hasil pencarian judul', []);
        }

        // Bangun query dinamis: Tiap kata harus cocok (AND) di salah satu kolom (OR)
        const conditions = [];
        const values = [];
        
        words.forEach((word, index) => {
            const paramIndex = index + 1;
            conditions.push(`(title ILIKE $${paramIndex} OR title_ltr ILIKE $${paramIndex} OR search_keywords_ltr ILIKE $${paramIndex})`);
            values.push(`%${word}%`);
        });

        // Tambahkan limit sebagai parameter terakhir
        values.push(limit);
        const limitParamIndex = values.length;

        const sql = `
            SELECT id, title, title_ltr, author_id, category_id
            FROM books
            WHERE ${conditions.join(' AND ')}
            LIMIT $${limitParamIndex}
        `;

        const { rows } = await db.query(sql, values);

        sendSuccess(res, 200, 'Berhasil menemukan hasil pencarian judul', rows);

    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Terjadi kesalahan pada server saat melakukan pencarian judul');
    }
});

module.exports = router;
