const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const auth = require('../middleware/auth');

/**
 * @swagger
 * /api/orders/checkout:
 *   post:
 *     summary: Melakukan checkout keranjang belanja
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil checkout
 */
router.post('/checkout', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Ambil cart
        const cartRes = await db.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
        if (cartRes.rows.length === 0) return sendError(res, 400, 'Keranjang kosong');
        const cartId = cartRes.rows[0].id;

        // Ambil item
        const itemsRes = await db.query(`
            SELECT ci.id, ci.product_id, ci.quantity, p.price, p.stock, p.weight_grams
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.cart_id = $1
        `, [cartId]);

        if (itemsRes.rows.length === 0) return sendError(res, 400, 'Keranjang kosong');

        let totalPrice = 0;
        let totalWeight = 0;

        for (let item of itemsRes.rows) {
            if (item.stock < item.quantity) {
                return sendError(res, 400, `Stok produk tidak mencukupi untuk product_id: ${item.product_id}`);
            }
            totalPrice += (parseFloat(item.price) * item.quantity);
            totalWeight += (item.weight_grams * item.quantity);
        }

        const shippingCost = 15000; // Flat rate ongkir untuk saat ini
        const grandTotal = totalPrice + shippingCost;
        const orderNumber = 'INV-' + Date.now();

        // Buat pesanan
        const orderRes = await db.query(`
            INSERT INTO orders (order_number, user_id, total_price, shipping_cost, grand_total, total_weight_grams)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [orderNumber, userId, totalPrice, shippingCost, grandTotal, totalWeight]);
        const orderId = orderRes.rows[0].id;

        // Pindahkan item & kurangi stok
        for (let item of itemsRes.rows) {
            await db.query(`
                INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
                VALUES ($1, $2, $3, $4)
            `, [orderId, item.product_id, item.quantity, item.price]);

            await db.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
        }

        // Kosongkan keranjang
        await db.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

        sendSuccess(res, { order_id: orderId, order_number: orderNumber }, 'Checkout berhasil');
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error saat checkout');
    }
});

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Mendapatkan riwayat pesanan user
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil mendapatkan daftar pesanan
 */
router.get('/', auth, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
        sendSuccess(res, rows);
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

module.exports = router;
