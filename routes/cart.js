const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const auth = require('../middleware/auth');

// Helper to get or create cart
async function getOrCreateCart(userId) {
    let result = await db.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
        result = await db.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [userId]);
    }
    return result.rows[0].id;
}

/**
 * @swagger
 * /api/cart:
 *   get:
 *     summary: Mendapatkan isi keranjang belanja
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, async (req, res) => {
    try {
        const cartId = await getOrCreateCart(req.user.id);
        
        const query = `
            SELECT ci.id as cart_item_id, ci.quantity, ci.added_at, 
                   p.id as product_id, p.title, p.price, p.stock, p.cover_image_url
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.cart_id = $1
            ORDER BY ci.added_at DESC
        `;
        const { rows } = await db.query(query, [cartId]);

        // Calculate total
        let cartTotal = 0;
        rows.forEach(item => {
            cartTotal += (item.quantity * parseFloat(item.price));
        });

        sendSuccess(res, {
            cart_id: cartId,
            items: rows,
            total: cartTotal
        });
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

/**
 * @swagger
 * /api/cart:
 *   post:
 *     summary: Menambahkan produk ke keranjang
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', auth, async (req, res) => {
    try {
        const { product_id, quantity = 1 } = req.body;
        if (!product_id) return sendError(res, 400, 'product_id wajib diisi');

        // Cek stok produk
        const productRes = await db.query('SELECT stock FROM products WHERE id = $1', [product_id]);
        if (productRes.rows.length === 0) return sendError(res, 404, 'Produk tidak ditemukan');
        if (productRes.rows[0].stock < quantity) return sendError(res, 400, 'Stok tidak mencukupi');

        const cartId = await getOrCreateCart(req.user.id);

        // Cek jika produk sudah ada di keranjang
        const existRes = await db.query('SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2', [cartId, product_id]);
        
        if (existRes.rows.length > 0) {
            // Update quantity
            const newQty = existRes.rows[0].quantity + quantity;
            if (newQty > productRes.rows[0].stock) return sendError(res, 400, 'Stok tidak mencukupi');
            
            await db.query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [newQty, existRes.rows[0].id]);
        } else {
            // Add new item
            await db.query('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)', [cartId, product_id, quantity]);
        }

        sendSuccess(res, null, 'Produk berhasil ditambahkan ke keranjang');
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

/**
 * @swagger
 * /api/cart/{itemId}:
 *   put:
 *     summary: Mengubah kuantitas item di keranjang
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:itemId', auth, async (req, res) => {
    try {
        const { quantity } = req.body;
        if (!quantity || quantity < 1) return sendError(res, 400, 'Kuantitas tidak valid');

        const { itemId } = req.params;
        
        // Cek kepemilikan keranjang
        const checkRes = await db.query('SELECT c.user_id, ci.product_id FROM cart_items ci JOIN carts c ON ci.cart_id = c.id WHERE ci.id = $1', [itemId]);
        if (checkRes.rows.length === 0) return sendError(res, 404, 'Item tidak ditemukan');
        if (checkRes.rows[0].user_id !== req.user.id) return sendError(res, 403, 'Akses ditolak');

        // Cek stok
        const prodRes = await db.query('SELECT stock FROM products WHERE id = $1', [checkRes.rows[0].product_id]);
        if (prodRes.rows[0].stock < quantity) return sendError(res, 400, 'Stok tidak mencukupi');

        await db.query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [quantity, itemId]);
        sendSuccess(res, null, 'Keranjang diperbarui');
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

/**
 * @swagger
 * /api/cart/{itemId}:
 *   delete:
 *     summary: Menghapus item dari keranjang
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:itemId', auth, async (req, res) => {
    try {
        const { itemId } = req.params;
        
        const checkRes = await db.query('SELECT c.user_id FROM cart_items ci JOIN carts c ON ci.cart_id = c.id WHERE ci.id = $1', [itemId]);
        if (checkRes.rows.length > 0 && checkRes.rows[0].user_id === req.user.id) {
            await db.query('DELETE FROM cart_items WHERE id = $1', [itemId]);
        }
        
        sendSuccess(res, null, 'Item dihapus dari keranjang');
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

module.exports = router;
