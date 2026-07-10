const path = require('path');
const fs = require('fs');
const { isBot } = require('./visitorTracking');
const { buildPrerenderPages } = require('../utils/prerenderPages');
const { injectPrerenderIntoTemplate } = require('../utils/prerenderMeta');

const SKIP_PREFIXES = ['/api/', '/api', '/uploads'];
const SKIP_EXACT = ['/robots.txt', '/sitemap.xml', '/sitemap-main.xml', '/sitemap-articles.xml'];

let templateCache = null;
let pagesCache = { tenantId: null, fetchedAt: 0, data: null };
const CACHE_MS = Number(process.env.PRERENDER_CACHE_MS) || 5 * 60 * 1000;

function getClientBuildPath() {
  return (
    process.env.CLIENT_BUILD_PATH ||
    path.resolve(__dirname, '..', '..', 'client', 'build')
  );
}

function loadTemplate() {
  if (templateCache) return templateCache;
  const indexPath = path.join(getClientBuildPath(), 'index.html');
  if (!fs.existsSync(indexPath)) return null;
  templateCache = fs.readFileSync(indexPath, 'utf8');
  return templateCache;
}

async function getPagesData(tenantId) {
  const now = Date.now();
  if (
    pagesCache.data &&
    pagesCache.tenantId === String(tenantId || '') &&
    now - pagesCache.fetchedAt < CACHE_MS
  ) {
    return pagesCache.data;
  }
  const data = await buildPrerenderPages(tenantId);
  pagesCache = { tenantId: String(tenantId || ''), fetchedAt: now, data };
  return data;
}

function normalizePath(urlPath) {
  if (!urlPath || urlPath === '/') return '/';
  const withoutQuery = urlPath.split('?')[0];
  return withoutQuery.endsWith('/') && withoutQuery.length > 1
    ? withoutQuery.slice(0, -1)
    : withoutQuery;
}

function shouldHandle(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const p = req.path || req.url?.split('?')[0] || '';
  if (SKIP_EXACT.includes(p)) return false;
  if (SKIP_PREFIXES.some((prefix) => p.startsWith(prefix))) return false;
  if (p.includes('.')) return false;
  const accept = req.headers.accept || '';
  if (!accept.includes('text/html') && !isBot(req.headers['user-agent'])) return false;
  return true;
}

/**
 * Runtime SSR for bots: inject DB-backed meta into SPA shell.
 * Enable with PRERENDER_RUNTIME=true and optional CLIENT_BUILD_PATH.
 */
async function prerenderMiddleware(req, res, next) {
  if (process.env.PRERENDER_RUNTIME !== 'true') return next();
  if (!shouldHandle(req)) return next();

  const template = loadTemplate();
  if (!template) return next();

  try {
    const pagePath = normalizePath(req.path);
    const data = await getPagesData(req.tenantId);
    const page = data.pages.find((p) => p.path === pagePath);
    if (!page) return next();

    const html = injectPrerenderIntoTemplate(template, page, data.siteSettings);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Prerender', 'runtime');
    return res.status(200).send(html);
  } catch (err) {
    return next();
  }
}

module.exports = { prerenderMiddleware };
