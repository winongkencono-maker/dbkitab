const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Format is "Bearer <token>"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return sendError(res, 401, 'Akses ditolak. Token tidak ditemukan.');
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return sendError(res, 403, 'Token tidak valid atau sudah kadaluarsa.');
        }
        // Save the decoded user payload to request object
        req.user = user;
        next();
    });
};

module.exports = { authenticateToken };
