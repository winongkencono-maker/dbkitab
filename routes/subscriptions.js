const express = require('express');
const router = express.Router();
const midtransClient = require('midtrans-client');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');

// Midtrans Core API & Snap Setup
const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

const snap = new midtransClient.Snap({
    isProduction: isProduction,
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// Subscription Plans (bisa dipindah ke DB di masa depan)
const PLANS = {
    'premium-1-month': {
        name: 'Premium 1 Bulan',
        price: 2500,
        durationDays: 30
    },
    'premium-1-year': {
        name: 'Premium 1 Tahun',
        price: 25000,
        durationDays: 365
    }
};

/**
 * @swagger
 * /api/subscriptions/checkout:
 *   post:
 *     summary: Checkout Premium Subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plan_id:
 *                 type: string
 *                 example: premium-1-month
 *     responses:
 *       200:
 *         description: Berhasil mendapatkan token pembayaran
 */
router.post('/checkout', authenticateToken, async (req, res) => {
    try {
        const { plan_id } = req.body;
        const userId = req.user.id;

        const plan = PLANS[plan_id];
        if (!plan) {
            return sendError(res, 400, 'Paket langganan tidak valid');
        }

        // Ambil data user
        const { rows } = await db.query('SELECT full_name, email FROM users WHERE id = $1', [userId]);
        if (rows.length === 0) return sendError(res, 404, 'User tidak ditemukan');
        const user = rows[0];

        // Buat Order ID dan Transaction ID
        const transactionId = uuidv4();
        const orderId = `SUB-${Date.now()}-${userId.substring(0, 5)}`;

        // Parameter Midtrans
        const parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: plan.price
            },
            customer_details: {
                first_name: user.full_name,
                email: user.email
            },
            item_details: [{
                id: plan_id,
                price: plan.price,
                quantity: 1,
                name: plan.name
            }]
        };

        // Minta Snap Token dari Midtrans
        const transaction = await snap.createTransaction(parameter);
        const snapToken = transaction.token;

        // Cek apakah user sudah punya row subscription
        const subRes = await db.query('SELECT id FROM subscriptions WHERE user_id = $1', [userId]);
        let subscriptionId;

        if (subRes.rows.length === 0) {
            subscriptionId = uuidv4();
            await db.query(`
                INSERT INTO subscriptions (id, user_id, status, plan_id, created_at, updated_at) 
                VALUES ($1, $2, 'inactive', $3, NOW(), NOW())
            `, [subscriptionId, userId, plan_id]);
        } else {
            subscriptionId = subRes.rows[0].id;
            await db.query(`UPDATE subscriptions SET plan_id = $1, updated_at = NOW() WHERE id = $2`, [plan_id, subscriptionId]);
        }

        // Simpan transaksi
        await db.query(`
            INSERT INTO transactions (id, user_id, subscription_id, gross_amount, transaction_status, order_id, snap_token, created_at)
            VALUES ($1, $2, $3, $4, 'pending', $5, $6, NOW())
        `, [transactionId, userId, subscriptionId, plan.price, orderId, snapToken]);

        sendSuccess(res, 200, 'Berhasil membuat pesanan', { 
            snap_token: snapToken, 
            order_id: orderId 
        });

    } catch (err) {
        console.error('Checkout error:', err);
        sendError(res, 500, 'Gagal memproses pembayaran');
    }
});

/**
 * @swagger
 * /api/subscriptions/webhook:
 *   post:
 *     summary: Midtrans Notification Webhook
 *     tags: [Subscriptions]
 *     responses:
 *       200:
 *         description: Notifikasi diterima
 */
router.post('/webhook', express.json(), async (req, res) => {
    try {
        const statusResponse = await snap.transaction.notification(req.body);
        const { order_id, transaction_status, fraud_status, payment_type } = statusResponse;

        // Cari transaksi di DB
        const trxRes = await db.query('SELECT * FROM transactions WHERE order_id = $1', [order_id]);
        if (trxRes.rows.length === 0) {
            return res.status(404).send('Transaction not found');
        }
        const trx = trxRes.rows[0];

        let finalStatus = 'pending';
        if (transaction_status == 'capture') {
            if (fraud_status == 'accept') { finalStatus = 'settled'; }
        } else if (transaction_status == 'settlement') {
            finalStatus = 'settled';
        } else if (transaction_status == 'cancel' || transaction_status == 'deny' || transaction_status == 'expire') {
            finalStatus = 'failed';
        }

        // Update Transactions
        await db.query(`
            UPDATE transactions 
            SET transaction_status = $1, payment_type = $2 
            WHERE order_id = $3
        `, [finalStatus, payment_type, order_id]);

        // Jika Lunas, aktifkan langganan
        if (finalStatus === 'settled') {
            const subRes = await db.query('SELECT * FROM subscriptions WHERE id = $1', [trx.subscription_id]);
            const sub = subRes.rows[0];
            const plan = PLANS[sub.plan_id];

            // Tentukan masa aktif
            let newEnd;
            if (sub.current_period_end && new Date(sub.current_period_end) > new Date()) {
                // Tambah masa aktif dari sisa
                newEnd = new Date(sub.current_period_end);
            } else {
                // Mulai dari sekarang
                newEnd = new Date();
                await db.query('UPDATE subscriptions SET current_period_start = NOW() WHERE id = $1', [sub.id]);
            }
            newEnd.setDate(newEnd.getDate() + plan.durationDays);

            await db.query(`
                UPDATE subscriptions 
                SET status = 'active', current_period_end = $1, updated_at = NOW() 
                WHERE id = $2
            `, [newEnd, sub.id]);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).send('Webhook failed');
    }
});

/**
 * @swagger
 * /api/subscriptions/status:
 *   get:
 *     summary: Cek Status Langganan User
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT status, current_period_start, current_period_end, plan_id 
            FROM subscriptions 
            WHERE user_id = $1
        `, [req.user.id]);

        if (rows.length === 0) {
            return sendSuccess(res, 200, 'Belum berlangganan', { status: 'inactive' });
        }

        const sub = rows[0];
        
        // Auto-expire check
        if (sub.status === 'active' && new Date(sub.current_period_end) < new Date()) {
            await db.query(`UPDATE subscriptions SET status = 'expired', updated_at = NOW() WHERE user_id = $1`, [req.user.id]);
            sub.status = 'expired';
        }

        sendSuccess(res, 200, 'Berhasil cek status', sub);
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Terjadi kesalahan server');
    }
});

module.exports = router;
