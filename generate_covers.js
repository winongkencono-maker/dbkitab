require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// Batas concurrency diturunkan agar tidak Out Of Memory (OOM) di VPS
const CONCURRENCY_LIMIT = 2;

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

const COVERS_DIR = path.join(__dirname, 'public', 'uploads', 'covers');
const TMP_DIR = path.join(__dirname, 'tmp_pdfs');

// Pastikan folder ada
if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
}
if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
}

// Helper untuk limit concurrency
async function asyncPool(poolLimit, array, iteratorFn) {
    const ret = [];
    const executing = [];
    for (const item of array) {
        const p = Promise.resolve().then(() => iteratorFn(item, array));
        ret.push(p);
        if (poolLimit <= array.length) {
            const e = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= poolLimit) {
                await Promise.race(executing);
            }
        }
    }
    return Promise.all(ret);
}

// Download stream
async function downloadFile(url, outputPath) {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        timeout: 30000 // 30 detik timeout
    });

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);
        let error = null;
        writer.on('error', err => {
            error = err;
            writer.close();
            reject(err);
        });
        writer.on('close', () => {
            if (!error) resolve(true);
        });
    });
}

// Tracking progress
let totalProcessed = 0;
let totalBooks = 0;

// Proses 1 buku
async function processBook(book) {
    const bookId = book.id;
    const pdfUrl = book.pdf_url || book.external_download_url;
    
    if (!pdfUrl) {
        totalProcessed++;
        console.log(`[${totalProcessed}/${totalBooks}] [SKIP] Buku ${bookId} tidak memiliki PDF URL.`);
        return false;
    }

    const tmpPdfPath = path.join(TMP_DIR, `${bookId}.pdf`);
    // pdftoppm akan otomatis menambahkan '-1.jpg' jika kita memintanya
    const outPrefix = path.join(COVERS_DIR, bookId); 
    const finalJpgPath = path.join(COVERS_DIR, `${bookId}-1.jpg`);
    const finalDbUrl = `/public/uploads/covers/${bookId}-1.jpg`;

    try {
        console.log(`[${totalProcessed + 1}/${totalBooks}] [PROSES] Buku ${bookId} -> Mengunduh PDF...`);
        await downloadFile(pdfUrl, tmpPdfPath);

        console.log(`[${totalProcessed + 1}/${totalBooks}] [PROSES] Buku ${bookId} -> Ekstrak Halaman 1...`);
        // Command pdftoppm: -f 1 (halaman pertama), -l 1 (sampai halaman 1), -jpeg (format jpg)
        // Resolusi bisa ditambah -r 150 atau dibiarkan default
        const cmd = `pdftoppm -f 1 -l 1 -jpeg -scale-to 800 "${tmpPdfPath}" "${outPrefix}"`;
        await execAsync(cmd);

        if (fs.existsSync(finalJpgPath)) {
            // Update DB
            await pool.query('UPDATE books SET cover_image_path = $1 WHERE id = $2', [finalDbUrl, bookId]);
            console.log(`✅ [SUKSES] Buku ${bookId} cover berhasil di-generate!`);
        } else {
            // Coba cari file output jika namanya berbeda (kadang tanpa -1 jika pdf rusak/berbeda versi)
            const files = fs.readdirSync(COVERS_DIR).filter(f => f.startsWith(bookId) && f.endsWith('.jpg'));
            if (files.length > 0) {
                const actualFile = files[0];
                await pool.query('UPDATE books SET cover_image_path = $1 WHERE id = $2', [`/public/uploads/covers/${actualFile}`, bookId]);
                console.log(`✅ [SUKSES] Buku ${bookId} cover berhasil (dengan nama ${actualFile})!`);
            } else {
                console.error(`❌ [GAGAL] Buku ${bookId} output JPG tidak ditemukan.`);
            }
        }
        
    } catch (err) {
        console.error(`❌ [ERROR] Buku ${bookId}:`, err.message || err);
        return false;
    } finally {
        // Hapus PDF sementara untuk hemat disk
        if (fs.existsSync(tmpPdfPath)) {
            try { fs.unlinkSync(tmpPdfPath); } catch(e){}
        }
        totalProcessed++;
    }
    
    return true;
}

async function run() {
    console.log('🚀 Memulai Generator Cover PDF...');
    try {
        // Ambil semua buku yang belum punya cover TAPI punya PDF URL
        const query = `
            SELECT b.id, bs.pdf_url, bs.external_download_url
            FROM books b
            JOIN book_sources bs ON b.id = bs.book_id
            WHERE (b.cover_image_path IS NULL OR b.cover_image_path = '')
              AND (bs.pdf_url IS NOT NULL OR bs.external_download_url IS NOT NULL)
        `;
        
        const { rows } = await pool.query(query);
        totalBooks = rows.length;
        totalProcessed = 0;
        
        console.log(`Ditemukan ${totalBooks} buku yang membutuhkan cover.`);

        if (rows.length === 0) {
            console.log('Tidak ada yang perlu diproses.');
            return;
        }

        console.log(`Memproses dengan concurrency: ${CONCURRENCY_LIMIT} paralel...`);
        
        await asyncPool(CONCURRENCY_LIMIT, rows, processBook);

        console.log('🎉 Selesai memproses semua cover!');
        
    } catch (err) {
        console.error('Terjadi kesalahan fatal:', err);
    } finally {
        pool.end();
    }
}

run();
