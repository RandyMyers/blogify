const csrf = require('csurf');

/**
 * CSRF protection configuration
 * Note: CSRF is primarily for cookie-based sessions.
 * API routes using Bearer token authentication don't need CSRF protection.
 */
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

/**
 * Skip CSRF for API routes that use Bearer token authentication
 * Apply CSRF for other routes (if needed for cookie-based sessions)
 */
const skipCsrfForApi = (req, res, next) => {
  // Skip CSRF for API routes that use Bearer token authentication
  if (req.path.startsWith('/api/') && 
      req.headers.authorization && 
      req.headers.authorization.startsWith('Bearer')) {
    return next();
  }
  
  // Skip CSRF for health check and other public endpoints
  if (req.path === '/health' || req.path.startsWith('/api-docs')) {
    return next();
  }
  
  // Apply CSRF for other routes (currently not used, but available for future cookie-based routes)
  // For now, we'll skip CSRF since all authentication uses Bearer tokens
  return next();
};

/**
 * Get CSRF token endpoint helper
 * This can be used if cookie-based sessions are added in the future
 */
const getCsrfToken = (req, res) => {
  return req.csrfToken ? req.csrfToken() : null;
};

module.exports = {
  csrfProtection: skipCsrfForApi,
  getCsrfToken
};


