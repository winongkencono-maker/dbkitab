require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

async function runSeed() {
    console.log('🚀 Memulai proses Seeding Data Dummy...');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 0. Ambil target Admin & Kitab
        const adminEmail = 'admin@admin.com';
        let adminRes = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
        if (adminRes.rows.length === 0) {
            throw new Error('Akun admin@admin.com tidak ditemukan!');
        }
        const adminId = adminRes.rows[0].id;
        console.log(`✅ Admin ID ditemukan: ${adminId}`);

        const book1Id = '4eb52ca4-3bb6-46db-bbb2-485d58df5731'; // السنة لابن أبي عاصم
        const book2Id = 'dc72bca3-aa56-43f2-80ad-9521000090f8'; // الفروع وتصحيح الفروع
        const catId = '89efbfc3-7fdc-46aa-ab4b-266af2bd2d66'; // العقيدة

        // 1. Generate 3 Dummy Users
        console.log('👥 Menginjeksi 3 User Dummy...');
        const dummyUsers = [
            { id: uuidv4(), name: 'Ahmad Fulan', email: 'ahmad@dummy.com', phone: '081234567890' },
            { id: uuidv4(), name: 'Fatimah Zahra', email: 'fatimah@dummy.com', phone: '081234567891' },
            { id: uuidv4(), name: 'Umar Khattab', email: 'umar@dummy.com', phone: '081234567892' }
        ];
        
        const salt = await bcrypt.genSalt(10);
        const passHash = await bcrypt.hash('password123', salt);

        for (const user of dummyUsers) {
            await client.query(`
                INSERT INTO users (id, full_name, email, password_hash)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (email) DO NOTHING
            `, [user.id, user.name, user.email, passHash]);

            await client.query(`
                INSERT INTO user_profiles (user_id, phone_number)
                VALUES ($1, $2)
                ON CONFLICT (user_id) DO NOTHING
            `, [user.id, user.phone]);
        }

        // 2. Generate 10 Produk
        console.log('🛍️ Menginjeksi 10 Produk Fisik...');
        const products = [
            { id: uuidv4(), title: 'Kitab As-Sunnah Ibnu Abi Ashim (Hardcover)', desc: 'Cetakan eksklusif dari Darus Sunnah, kertas berkualitas.', price: 150000, stock: 20, weight: 800, linked: book1Id, category: catId },
            { id: uuidv4(), title: 'Kitab Al-Furu\' (4 Jilid Lengkap)', desc: 'Kitab Fiqih perbandingan madzhab cetakan Darul Kutub Al-Ilmiyyah.', price: 600000, stock: 5, weight: 3500, linked: book2Id, category: catId },
            { id: uuidv4(), title: 'Tafsir Ibnu Kathir (Terjemahan Bahasa Indonesia 8 Jilid)', desc: 'Tafsir paling populer. Terjemahan lengkap.', price: 1200000, stock: 10, weight: 8000, linked: null, category: null },
            { id: uuidv4(), title: 'Sahih Al-Bukhari (Cetakan Darussalam)', desc: 'Teks Arab lengkap dengan Takhrij.', price: 250000, stock: 15, weight: 1200, linked: null, category: null },
            { id: uuidv4(), title: 'Rehal Kayu Jati Ukir Jepara (Meja Ngaji)', desc: 'Meja lipat dari kayu jati asli ukiran Jepara.', price: 175000, stock: 30, weight: 1500, linked: null, category: null },
            { id: uuidv4(), title: 'Tasbih Digital Premium LED', desc: 'Tasbih dengan penghitung digital dan lampu LED.', price: 45000, stock: 100, weight: 100, linked: null, category: null },
            { id: uuidv4(), title: 'Parfum Kasturi Kijang Asli (Non-Alkohol)', desc: 'Wewangian sunnah bebas alkohol.', price: 85000, stock: 50, weight: 150, linked: null, category: null },
            { id: uuidv4(), title: 'Buku "Sirah Nabawiyah" Syaikh Shafiyurrahman', desc: 'Buku sejarah nabi terbaik.', price: 110000, stock: 25, weight: 600, linked: null, category: null },
            { id: uuidv4(), title: 'Mushaf Al-Quran Tajwid Warna (A5)', desc: 'Al-Quran tajwid warna ukuran sedang.', price: 95000, stock: 40, weight: 500, linked: null, category: null },
            { id: uuidv4(), title: 'Pena Eksklusif & Pembatas Buku Islami', desc: 'Satu set alat tulis eksklusif.', price: 50000, stock: 100, weight: 200, linked: null, category: null }
        ];

        for (const p of products) {
            await client.query(`
                INSERT INTO products (id, title, description, price, stock, weight_grams, linked_book_id, category_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO NOTHING
            `, [p.id, p.title, p.desc, p.price, p.stock, p.weight, p.linked, p.category]);
        }

        // 3. Generate Galeri Gambar (~30+ gambar)
        console.log('🖼️ Menginjeksi Galeri Gambar Produk...');
        let imageCounter = 1;
        for (const p of products) {
            for (let i = 1; i <= 3; i++) {
                const isPrimary = i === 1;
                // Menggunakan placeholder acak yang estetik
                const imgUrl = "https://picsum.photos/seed/" + imageCounter + "/800/800";
                await client.query(`
                    INSERT INTO product_images (product_id, image_url, is_primary, sort_order)
                    VALUES ($1, $2, $3, $4)
                `, [p.id, imgUrl, isPrimary, i]);
                imageCounter++;
            }
        }

        // 4. Generate Ulasan/Review
        console.log('⭐ Menginjeksi Ulasan Produk...');
        const reviews = [
            { user: adminId, product: products[0].id, rating: 5, comment: 'Cetakan sangat rapi dan kertas kuning khas timur tengah.' },
            { user: adminId, product: products[9].id, rating: 4, comment: 'Pena enak dipakai.' },
            { user: dummyUsers[0].id, product: products[0].id, rating: 4, comment: 'Buku sampai dengan aman, packing rapi.' },
            { user: dummyUsers[1].id, product: products[1].id, rating: 5, comment: 'Jilidannya kuat, rekomended buat santri.' },
            { user: dummyUsers[1].id, product: products[4].id, rating: 5, comment: 'Kayu jatinya asli, ukiran bagus sekali!' }
        ];

        for (const r of reviews) {
            await client.query(`
                INSERT INTO product_reviews (product_id, user_id, rating, comment)
                VALUES ($1, $2, $3, $4)
            `, [r.product, r.user, r.rating, r.comment]);
        }

        // 5. Generate Voucher Diskon
        console.log('🎟️ Menginjeksi Voucher Promo...');
        await client.query(`
            INSERT INTO vouchers (code, discount_type, discount_value, min_purchase, valid_until)
            VALUES ('KITABBERKAH2026', 'fixed', 20000, 100000, '2026-12-31') ON CONFLICT DO NOTHING
        `);
        await client.query(`
            INSERT INTO vouchers (code, discount_type, discount_value, min_purchase, valid_until)
            VALUES ('GRATISONGKIR', 'fixed', 15000, 0, '2026-12-31') ON CONFLICT DO NOTHING
        `);

        // 6. Generate 4 Siklus Pesanan Admin & Order Items
        console.log('📦 Menginjeksi Riwayat Pesanan (Orders)...');
        
        const orderStatuses = [
            { status: 'delivered', total: 200000, weight: 1000 },
            { status: 'shipped', total: 1200000, weight: 7000 },
            { status: 'pending', total: 150000, weight: 800 },
            { status: 'cancelled', total: 45000, weight: 100 }
        ];

        let orderIdx = 1;
        for (const os of orderStatuses) {
            const orderId = uuidv4();
            await client.query(`
                INSERT INTO orders (id, order_number, user_id, total_price, shipping_cost, grand_total, total_weight_grams, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [orderId, "INV-2026-" + orderIdx + "000" + orderIdx, adminId, os.total, 15000, os.total + 15000, os.weight, os.status]);
            
            // Masukkan order items
            if (os.status === 'delivered') {
                // Buku As-Sunnah & Pena
                await client.query('INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4)', [orderId, products[0].id, 1, products[0].price]);
                await client.query('INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4)', [orderId, products[9].id, 1, products[9].price]);
            } else if (os.status === 'shipped') {
                // Al Furu' (2 sets)
                await client.query('INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4)', [orderId, products[1].id, 2, products[1].price]);
            } else if (os.status === 'pending') {
                await client.query('INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4)', [orderId, products[0].id, 1, products[0].price]);
            } else {
                await client.query('INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4)', [orderId, products[5].id, 1, products[5].price]);
            }

            // 7. Generate Resi & Tracking
            if (os.status === 'delivered' || os.status === 'shipped') {
                const shipRes = await client.query(`
                    INSERT INTO shipments (order_id, courier_name, courier_service, tracking_number, status)
                    VALUES ($1, 'JNE', 'REG', $2, $3) RETURNING id
                `, [orderId, "JT" + Date.now(), os.status === 'delivered' ? 'delivered' : 'in_transit']);
                
                const shipId = shipRes.rows[0].id;
                
                // History 1
                await client.query(`INSERT INTO shipment_tracking_history (shipment_id, status_description, location) VALUES ($1, 'Paket telah diserahkan ke kurir', 'Jakarta')`, [shipId]);
                
                if (os.status === 'delivered') {
                    // History 2
                    await client.query(`INSERT INTO shipment_tracking_history (shipment_id, status_description, location) VALUES ($1, 'Paket berhasil dikirim ke penerima', 'Alamat Tujuan')`, [shipId]);
                }
            }

            orderIdx++;
        }

        // 8. Generate Keranjang Belanja (Cart)
        console.log('🛒 Mengisi Keranjang Belanja Admin...');
        const cartRes = await client.query('INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING id', [adminId]);
        const cartId = cartRes.rows[0].id;

        await client.query('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)', [cartId, products[2].id, 1]); // Tafsir
        await client.query('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)', [cartId, products[3].id, 2]); // Bukhari
        await client.query('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)', [cartId, products[6].id, 3]); // Parfum

        // 9. Generate Wishlist
        console.log('❤️ Mengisi Wishlist Admin...');
        for (let i = 0; i < 4; i++) {
            await client.query('INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [adminId, products[i].id]);
        }

        // 10. Generate Data Reader (Bookmarks, Highlights, dll)
        console.log('📖 Menginjeksi Data Kitab Digital (Reader)...');
        // Bookmarks
        await client.query('INSERT INTO bookmarks (user_id, book_id, page_number, bookmark_title) VALUES ($1, $2, $3, $4)', [adminId, book1Id, 24, 'Dalil penting tentang sifat']);
        await client.query('INSERT INTO bookmarks (user_id, book_id, page_number, bookmark_title) VALUES ($1, $2, $3, $4)', [adminId, book1Id, 5, 'Definisi secara etimologi']);
        await client.query('INSERT INTO bookmarks (user_id, book_id, page_number, bookmark_title) VALUES ($1, $2, $3, $4)', [adminId, book2Id, 110, 'Pembahasan Shalat']);

        // Highlights
        await client.query('INSERT INTO highlights (user_id, book_id, highlighted_text, color_hex, start_position, end_position) VALUES ($1, $2, $3, $4, 0, 100)', [adminId, book1Id, 'Menjaga sunnah adalah kewajiban', '#FFFF00']);
        await client.query('INSERT INTO highlights (user_id, book_id, highlighted_text, color_hex, start_position, end_position) VALUES ($1, $2, $3, $4, 0, 100)', [adminId, book1Id, 'Sanad hadits ini jayyid', '#00FF00']); // Hijau
        await client.query('INSERT INTO highlights (user_id, book_id, highlighted_text, color_hex, start_position, end_position) VALUES ($1, $2, $3, $4, 0, 100)', [adminId, book1Id, 'Ibnu Taimiyyah berkata...', '#0000FF']); // Biru

        // Reading Progress
        await client.query(`
            INSERT INTO reading_progress (user_id, book_id, last_page_number, progress_percentage, last_read_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, book_id) DO UPDATE SET last_page_number = EXCLUDED.last_page_number, progress_percentage = EXCLUDED.progress_percentage
        `, [adminId, book1Id, 104, 50]);
        
        await client.query(`
            INSERT INTO reading_progress (user_id, book_id, last_page_number, progress_percentage, last_read_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, book_id) DO UPDATE SET last_page_number = EXCLUDED.last_page_number, progress_percentage = EXCLUDED.progress_percentage
        `, [adminId, book2Id, 15, 10]);

        await client.query('COMMIT');
        console.log('✅ SEEDING SELESAI DENGAN SUKSES!');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ SEEDING GAGAL:', err);
    } finally {
        client.release();
        pool.end();
    }
}

runSeed();
