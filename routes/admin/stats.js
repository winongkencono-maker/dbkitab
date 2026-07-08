const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { sendSuccess, sendError } = require('../../utils/response');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

router.use(auth, admin);

router.get('/', async (req, res) => {
    try {
        // Total orders & revenue
        const revRes = await db.query("SELECT COUNT(id) as total_orders, COALESCE(SUM(grand_total), 0) as revenue FROM orders WHERE status != 'cancelled'");
        
        // Low stock products
        const stockRes = await db.query("SELECT id, title, stock FROM products WHERE stock < 5 ORDER BY stock ASC LIMIT 10");
        
        sendSuccess(res, {
            total_orders: parseInt(revRes.rows[0].total_orders),
            total_revenue: parseFloat(revRes.rows[0].revenue),
            low_stock_products: stockRes.rows
        });
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

module.exports = router;
