/**
 * Standardize API Response
 * 
 * @param {Response} res Express response object
 * @param {Number} statusCode HTTP status code
 * @param {String} message Response message
 * @param {Array|Object} data The main payload
 * @param {Object} meta Pagination or extra metadata (optional)
 */
function sendSuccess(res, statusCode, message, data, meta = null) {
    const response = {
        status: 'success',
        message,
        data,
    };
    if (meta) {
        response.meta = meta;
    }
    return res.status(statusCode).json(response);
}

function sendError(res, statusCode, message, errorDetails = null) {
    const response = {
        status: 'error',
        message,
    };
    if (errorDetails) {
        response.error = errorDetails;
    }
    return res.status(statusCode).json(response);
}

module.exports = {
    sendSuccess,
    sendError
};
