const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Ensure directory exists
const uploadDir = path.join(__dirname, '../public/uploads/community_book');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Setup Multer Storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Keep original filename or generate a unique one
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

/**
 * @swagger
 * /api/community-books/upload:
 *   post:
 *     summary: Upload a new community book
 *     tags: [Community Books]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         description: The book file to upload
 *         required: true
 *       - in: formData
 *         name: title
 *         type: string
 *         description: Book title
 *         required: true
 *       - in: formData
 *         name: author
 *         type: string
 *         description: Book author
 *       - in: formData
 *         name: description
 *         type: string
 *         description: Book description
 *       - in: formData
 *         name: user_id
 *         type: string
 *         description: ID of the user uploading the book
 *         required: true
 *     responses:
 *       201:
 *         description: Book uploaded successfully
 *       400:
 *         description: Missing required fields
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const { title, author, description, user_id } = req.body;
  if (!title || !user_id) {
    return res.status(400).json({ error: 'Title and user_id are required.' });
  }

  const client = await pool.connect();
  try {
    // Relative path for database storing
    const filePath = `/public/uploads/community_book/${req.file.filename}`;

    const insertQuery = `
      INSERT INTO community_books (user_id, title, author, description, file_path, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *;
    `;
    const values = [user_id, title, author, description, filePath];

    const result = await client.query(insertQuery, values);
    res.status(201).json({
      message: 'Book uploaded successfully. Waiting for admin approval.',
      book: result.rows[0]
    });
  } catch (err) {
    console.error('Error inserting community book:', err);
    res.status(500).json({ error: 'Internal server error during upload.' });
  } finally {
    client.release();
  }
});

module.exports = router;
