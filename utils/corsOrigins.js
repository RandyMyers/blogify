/**
 * Exact browser origins permitted to call the production API.
 */

const APPROVED_PRODUCTION_ORIGINS = [
  'https://bloomwik.com',
  'https://eloquent-taffy-866b1b.netlify.app',
  'https://fabulous-arithmetic-400162.netlify.app',
];

function isLocalhostOrigin(origin) {
  return (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  );
}

/**
 * @param {string|undefined} origin
 * @param {{ isDevelopment?: boolean }} options
 */
function isAllowedOrigin(origin, { isDevelopment = false } = {}) {
  if (!origin) return isDevelopment;

  if (isDevelopment && isLocalhostOrigin(origin)) {
    return true;
  }

  // Keep the production allowlist closed: deployment environment values must not
  // silently authorize additional preview or copied-site origins.
  return APPROVED_PRODUCTION_ORIGINS.includes(origin);
}

/** Exact allowlist merged with local development origins. */
function buildAllowedOrigins({ isDevelopment = false } = {}) {
  const origins = [...APPROVED_PRODUCTION_ORIGINS];
  if (isDevelopment) {
    origins.push('http://localhost:3000', 'http://localhost:3001');
  }
  return origins;
}

module.exports = {
  isAllowedOrigin,
  buildAllowedOrigins,
};
