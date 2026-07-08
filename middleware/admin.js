const { sendError } = require('../utils/response');

const admin = (req, res, next) => {
    // Middleware ini dipasang setelah middleware auth
    if (!req.user || req.user.role !== 'admin') {
        return sendError(res, 403, 'Akses ditolak. Anda tidak memiliki izin Admin.');
    }
    next();
};

module.exports = admin;
