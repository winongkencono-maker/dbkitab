const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { sendSuccess, sendError } = require('../../utils/response');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

router.use(auth, admin);

// Input resi pengiriman
router.post('/order/:orderId', async (req, res) => {
    const { courier_name, courier_service, tracking_number } = req.body;
    try {
        const orderId = req.params.orderId;
        const result = await db.query(`
            INSERT INTO shipments (order_id, courier_name, courier_service, tracking_number, shipped_at, status)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'in_transit')
            RETURNING *
        `, [orderId, courier_name, courier_service, tracking_number]);
        
        // Update order status to shipped
        await db.query("UPDATE orders SET status = 'shipped' WHERE id = $1", [orderId]);
        
        sendSuccess(res, result.rows[0], 'Resi berhasil diinput');
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

// Update tracking history
router.post('/:shipmentId/history', async (req, res) => {
    const { status_description, location } = req.body;
    try {
        const result = await db.query(`
            INSERT INTO shipment_tracking_history (shipment_id, status_description, location)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [req.params.shipmentId, status_description, location]);
        
        sendSuccess(res, result.rows[0], 'Tracking diupdate');
    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Server error');
    }
});

module.exports = router;
