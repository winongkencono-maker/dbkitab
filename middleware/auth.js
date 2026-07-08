const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');

const auth = (req, res, next) => {
    // Check header
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        return sendError(res, 401, 'Akses ditolak. Token tidak ditemukan.');
    }

    // Biasanya formatnya "Bearer <token>"
    const token = authHeader.split(' ')[1] || authHeader;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rahasia123');
        req.user = decoded; // { id, email, role }
        next();
    } catch (err) {
        return sendError(res, 401, 'Token tidak valid atau sudah kadaluarsa.');
    }
};

module.exports = auth;
