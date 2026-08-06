/**
 * IndexNow utility (aligned with dealcouponz + Bing Webmaster visibility).
 *
 * Instantly notifies IndexNow engines when content is published/updated/deleted.
 *
 * Requires:
 *   - INDEXNOW_API_KEY env and/or SeoSettings.indexNow.apiKey
 *   - Key file at https://{host}/{key}.txt on the public client host
 *
 * Bing Webmaster Tools IndexNow report is most reliable when we also POST to
 * www.bing.com/indexnow (not only api.indexnow.org).
 */

const { buildArticleCanonicalUrlForRegion } = require('./canonicalUrl');
const { buildArticleHreflangRegions } = require('./regionSlug');
const { REGIONS } = require('../constants/regions');

const INDEXNOW_ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
];

const BATCH_SIZE = 10000;

/**
 * Build every public article URL that should be notified (all indexable regions).
 */
function buildArticlePublicUrls(article, baseUrl) {
  const base = String(baseUrl || process.env.CLIENT_URL || 'https://bloomwik.com').replace(/\/$/, '');
  const urls = [];

  const regional = buildArticleHreflangRegions(article, REGIONS, true);
  Object.entries(regional).forEach(([code, info]) => {
    const url = buildArticleCanonicalUrlForRegion(base, code, info?.slug);
    if (url) urls.push(url);
  });

  if (!urls.length) {
    const defaultLang = article.defaultLanguage || 'en';
    const slug =
      article.translations?.[defaultLang]?.slug || article.baseSlug || article.slug;
    if (slug) {
      urls.push(buildArticleCanonicalUrlForRegion(base, 'US', slug));
    }
  }

  return [...new Set(urls.filter(Boolean))];
}

async function resolveIndexNowConfig(options = {}) {
  let enabled = process.env.INDEXNOW_ENABLED !== 'false';
  let dbKey = '';
  let clientUrl = String(options.clientUrl || process.env.CLIENT_URL || 'https://bloomwik.com').replace(
    /\/$/,
    ''
  );

  if (options.tenantId) {
    try {
      const SeoSettings = require('../models/SeoSettings');
      const settings = await SeoSettings.findOne({ tenantId: options.tenantId }).lean();
      if (settings) {
        if (settings.indexNow?.enabled === false) enabled = false;
        if (settings.indexNow?.apiKey) dbKey = String(settings.indexNow.apiKey).trim();
        if (settings.siteUrl) clientUrl = String(settings.siteUrl).replace(/\/$/, '');
      }
    } catch {
      /* env fallback */
    }
  }

  // Admin SEO settings key is primary; env is fallback for ops/defaults.
  const key = String(dbKey || process.env.INDEXNOW_API_KEY || '').trim();

  return { key, enabled, clientUrl };
}

async function postToEndpoint(endpoint, payload) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  let body = '';
  try {
    body = await res.text();
  } catch {
    body = '';
  }
  return {
    endpoint,
    status: res.status,
    ok: res.status >= 200 && res.status < 300,
    body: body.slice(0, 300),
  };
}

/**
 * Submit an absolute URL list to IndexNow (api.indexnow.org + Bing).
 */
async function submitUrlList(urlList, options = {}) {
  const { key, enabled, clientUrl } = await resolveIndexNowConfig(options);

  if (!enabled) {
    return { skipped: true, reason: 'IndexNow disabled' };
  }
  if (!key) {
    return { skipped: true, reason: 'IndexNow key not configured (set INDEXNOW_API_KEY or SEO settings key)' };
  }

  let host;
  try {
    host = new URL(clientUrl).hostname;
  } catch {
    return { skipped: true, reason: 'Invalid site URL' };
  }

  const urls = [...new Set((urlList || []).filter(Boolean))];
  if (!urls.length) {
    return { skipped: true, reason: 'No public URLs' };
  }

  const keyLocation = `${clientUrl}/${key}.txt`;
  const payloadBase = { host, key, keyLocation };

  const endpointResults = [];
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const payload = { ...payloadBase, urlList: batch };

    for (const endpoint of INDEXNOW_ENDPOINTS) {
      try {
        const result = await postToEndpoint(endpoint, payload);
        endpointResults.push({ ...result, urlCount: batch.length });
      } catch (error) {
        endpointResults.push({
          endpoint,
          status: 0,
          ok: false,
          body: error.message,
          urlCount: batch.length,
        });
      }
    }
  }

  const bing = endpointResults.find((r) => r.endpoint.includes('bing.com'));
  const api = endpointResults.find((r) => r.endpoint.includes('indexnow.org'));
  const ok = endpointResults.some((r) => r.ok);

  return {
    ok,
    statusCode: bing?.status || api?.status || endpointResults[0]?.status,
    urlCount: urls.length,
    host,
    keyLocation,
    endpoints: endpointResults,
    bingStatus: bing?.status ?? null,
    apiStatus: api?.status ?? null,
  };
}

/**
 * Notify IndexNow when a published article is created, updated, unpublished, or deleted.
 */
async function notifyArticlePublished(article, options = {}) {
  const { clientUrl } = await resolveIndexNowConfig(options);
  const urlList = buildArticlePublicUrls(article, clientUrl);
  return submitUrlList(urlList, options);
}

module.exports = {
  buildArticlePublicUrls,
  submitUrlList,
  notifyArticlePublished,
};
