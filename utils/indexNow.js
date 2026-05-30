const https = require('https');

/**
 * Build public article URLs for search-engine notification (default US slug).
 */
function buildArticlePublicUrls(article, baseUrl) {
  const base = (baseUrl || process.env.CLIENT_URL || 'https://bloomwik.com').replace(/\/$/, '');
  const urls = [];
  const defaultLang = article.defaultLanguage || 'en';
  const defaultSlug =
    article.translations?.[defaultLang]?.slug || article.baseSlug || article.slug;

  if (defaultSlug) {
    urls.push(`${base}/article/${encodeURIComponent(defaultSlug)}`);
  }

  Object.entries(article.translations || {}).forEach(([lang, tr]) => {
    if (!tr?.slug || tr.slug === defaultSlug) return;
    urls.push(`${base}/article/${encodeURIComponent(tr.slug)}`);
  });

  return [...new Set(urls)];
}

function postIndexNow(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: 'api.indexnow.org',
        path: '/indexnow',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 15000,
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(res.statusCode));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('IndexNow request timed out'));
    });
    req.write(body);
    req.end();
  });
}

/**
 * Notify Bing/Yandex/etc. when a published article changes.
 * Requires INDEXNOW_API_KEY and key file at https://{host}/{key}.txt on the client host.
 */
async function notifyArticlePublished(article, options = {}) {
  let key = process.env.INDEXNOW_API_KEY;
  let clientUrl = (options.clientUrl || process.env.CLIENT_URL || 'https://bloomwik.com').replace(
    /\/$/,
    ''
  );

  if (options.tenantId) {
    try {
      const SeoSettings = require('../models/SeoSettings');
      const settings = await SeoSettings.findOne({ tenantId: options.tenantId }).lean();
      if (settings) {
        if (settings.indexNow?.enabled === false) {
          return { skipped: true, reason: 'IndexNow disabled in SEO settings' };
        }
        if (settings.indexNow?.apiKey) key = settings.indexNow.apiKey;
        if (settings.siteUrl) clientUrl = settings.siteUrl.replace(/\/$/, '');
      }
    } catch {
      /* fall back to env */
    }
  }

  if (!key || process.env.INDEXNOW_ENABLED === 'false') {
    return { skipped: true, reason: 'IndexNow not configured' };
  }

  let host;
  try {
    host = new URL(clientUrl).hostname;
  } catch {
    return { skipped: true, reason: 'Invalid CLIENT_URL' };
  }

  const urlList = buildArticlePublicUrls(article, clientUrl);
  if (!urlList.length) {
    return { skipped: true, reason: 'No public URLs' };
  }

  const statusCode = await postIndexNow({
    host,
    key,
    keyLocation: `${clientUrl}/${key}.txt`,
    urlList,
  });

  return { ok: statusCode >= 200 && statusCode < 300, statusCode, urlCount: urlList.length };
}

module.exports = {
  buildArticlePublicUrls,
  notifyArticlePublished,
};
