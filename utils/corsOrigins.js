/**
 * Shared CORS origin checks for API requests from the public site, admin, and hosting platforms.
 */

const PLATFORM_SUFFIXES = ['.netlify.app', '.vercel.app'];

/** Production client domains (Hostinger). */
const BLOOMWIK_HOSTS = ['bloomwik.com', 'www.bloomwik.com'];

function normalizeHost(origin) {
  if (!origin) return '';
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isBloomwikOrigin(origin) {
  const host = normalizeHost(origin);
  if (!host) return false;
  if (BLOOMWIK_HOSTS.includes(host)) return true;
  return host.endsWith('.bloomwik.com');
}

function isLocalhostOrigin(origin) {
  return (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  );
}

function isPlatformOrigin(origin) {
  return PLATFORM_SUFFIXES.some((suffix) => origin.endsWith(suffix));
}

/**
 * @param {string|undefined} origin
 * @param {{ clientUrl?: string, adminUrl?: string, isDevelopment?: boolean }} options
 */
function isAllowedOrigin(origin, { clientUrl, adminUrl, isDevelopment = false } = {}) {
  if (!origin) return isDevelopment;

  if (isDevelopment && isLocalhostOrigin(origin)) {
    return true;
  }

  if (clientUrl && origin === clientUrl) return true;
  if (adminUrl && origin === adminUrl) return true;

  if (isBloomwikOrigin(origin)) return true;
  if (isPlatformOrigin(origin)) return true;

  return false;
}

/** Static allowlist merged with env URLs for the cors package callback. */
function buildAllowedOrigins({ clientUrl, adminUrl, isDevelopment = false } = {}) {
  const origins = new Set(
    [
      clientUrl,
      adminUrl,
      'https://bloomwik.com',
      'https://www.bloomwik.com',
      'https://fabulous-arithmetic-400162.netlify.app',
      'https://eloquent-taffy-866b1b.netlify.app',
      ...(isDevelopment ? ['http://localhost:3000', 'http://localhost:3001'] : []),
    ].filter(Boolean)
  );
  return [...origins];
}

module.exports = {
  isAllowedOrigin,
  buildAllowedOrigins,
  isBloomwikOrigin,
};
