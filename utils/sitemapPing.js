const https = require('https');

function getUrl(baseUrl, path) {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function pingUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = https.request(
        {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          method: 'GET',
          timeout: 12000,
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve({ url, statusCode: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 400 }));
        }
      );
      req.on('error', (err) => resolve({ url, ok: false, error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ url, ok: false, error: 'timeout' });
      });
      req.end();
    } catch (err) {
      resolve({ url, ok: false, error: err.message });
    }
  });
}

/**
 * Ping Google and Bing to recrawl sitemap.xml.
 */
async function pingSearchEngines(siteUrl) {
  const sitemapUrl = getUrl(siteUrl, '/sitemap.xml');
  const encoded = encodeURIComponent(sitemapUrl);

  const targets = [
    `https://www.google.com/ping?sitemap=${encoded}`,
    `https://www.bing.com/ping?sitemap=${encoded}`,
  ];

  const results = await Promise.all(targets.map(pingUrl));
  return { sitemapUrl, results };
}

module.exports = { pingSearchEngines, getUrl };
