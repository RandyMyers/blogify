const crypto = require('crypto');

/**
 * Add unique request ID to each request
 * Request ID is included in response headers and logs for tracing
 */
const requestId = (req, res, next) => {
  // Use existing X-Request-ID header or generate new one
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
};

module.exports = requestId;

