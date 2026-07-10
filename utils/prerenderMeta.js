const { LANG_PREFERRED_REGION } = require('./canonicalUrl');

const STATIC_PAGES = [
  { path: '/', title: 'Home', description: 'Discover thoughtful articles on technology, design, lifestyle and more.' },
  { path: '/categories', title: 'All Categories', description: 'Explore our diverse range of topics and discover articles that match your interests.' },
  { path: '/authors', title: 'Our Authors', description: 'Meet the talented writers who share their insights and expertise.' },
  { path: '/trending', title: 'Trending Articles', description: 'Discover the most popular articles our community is reading right now.' },
  { path: '/about', title: 'About', description: 'Learn about Bloomwik and our mission.' },
  { path: '/contact', title: 'Contact', description: 'Get in touch with the Bloomwik team.' },
  { path: '/privacy', title: 'Privacy Policy', description: 'Bloomwik privacy policy.' },
  { path: '/terms', title: 'Terms of Service', description: 'Bloomwik terms of service.' },
];

function normalizeSiteUrl(siteUrl) {
  return String(siteUrl || 'https://bloomwik.com').replace(/\/$/, '');
}

function pathForRegion(regionCode, pagePath = '/') {
  const code = (regionCode || 'US').toUpperCase();
  const normalized = pagePath === '/' || !pagePath ? '/' : pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  if (code === 'US') return normalized;
  return normalized === '/' ? `/${code.toLowerCase()}` : `/${code.toLowerCase()}${normalized}`;
}

function absUrl(siteUrl, pathname) {
  const base = normalizeSiteUrl(siteUrl);
  if (!pathname || pathname === '/') return `${base}/`;
  return `${base}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPageTitle(metaTitle, siteName) {
  if (!metaTitle) return siteName;
  if (metaTitle.includes(siteName)) return metaTitle;
  return `${metaTitle} | ${siteName}`;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildHreflangLinks(hreflang) {
  if (!Array.isArray(hreflang) || hreflang.length === 0) return '';
  return hreflang
    .map(
      ({ lang, href }) =>
        `    <link rel="alternate" hreflang="${escapeHtml(lang)}" href="${escapeHtml(href)}" />`
    )
    .join('\n');
}

function buildKeywordsMeta(keywords) {
  const list = (Array.isArray(keywords) ? keywords : [])
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  if (!list.length) return '';
  return `    <meta name="keywords" content="${escapeHtml(list.join(', '))}" />`;
}

function buildJsonLdScripts(jsonLd) {
  const blocks = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  return blocks
    .filter(Boolean)
    .map(
      (data) =>
        `    <script type="application/ld+json">${JSON.stringify(data)}</script>`
    )
    .join('\n');
}

/**
 * Render prerendered <head> meta block (inserted into index.html template).
 */
function renderPrerenderHead(page, siteSettings = {}) {
  const siteName = siteSettings.siteName || 'Bloomwik';
  const siteUrl = normalizeSiteUrl(siteSettings.siteUrl);
  const xDefault = siteSettings.hreflang?.xDefaultLanguage || 'en';
  const hreflangEnabled = siteSettings.hreflang?.enabled !== false;

  const title = buildPageTitle(page.metaTitle || page.title, siteName);
  const description = page.metaDescription || page.description || '';
  const canonical = page.canonicalUrl || absUrl(siteUrl, page.path);
  const robots = page.robots || 'index, follow';
  const lang = page.language || 'en';

  const ogTitle = page.ogTitle || page.metaTitle || page.title || title;
  const ogDescription = page.ogDescription || page.metaDescription || page.description || '';
  const ogImage = page.ogImage ? absUrl(siteUrl, page.ogImage) : '';
  const twitterTitle = page.twitterTitle || ogTitle;
  const twitterDescription = page.twitterDescription || ogDescription;
  const twitterCard = page.twitterCard || 'summary_large_image';
  const twitterSite = siteSettings.twitterHandle
    ? siteSettings.twitterHandle.startsWith('@')
      ? siteSettings.twitterHandle
      : `@${siteSettings.twitterHandle}`
    : '';

  const hreflangBlock = hreflangEnabled ? buildHreflangLinks(page.hreflang) : '';
  const keywordsBlock = buildKeywordsMeta(page.keywords);
  const jsonLdBlock = buildJsonLdScripts(page.jsonLd);

  const googleVerification = siteSettings.googleSiteVerification
    ? `    <meta name="google-site-verification" content="${escapeHtml(siteSettings.googleSiteVerification)}" />\n`
    : '';
  const bingVerification = siteSettings.bingSiteVerification
    ? `    <meta name="msvalidate.01" content="${escapeHtml(siteSettings.bingSiteVerification)}" />\n`
    : '';

  const ogLocale = lang === 'en' ? 'en_US' : `${lang}_${lang.toUpperCase()}`;
  const ogImageTag = ogImage
    ? `    <meta property="og:image" content="${escapeHtml(ogImage)}" />\n    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />\n`
    : '';

  const articleTags = (page.tags || [])
    .map((tag) => `    <meta property="article:tag" content="${escapeHtml(tag)}" />`)
    .join('\n');

  return `<!-- prerender-meta -->
    <title>${escapeHtml(title)}</title>
    <meta name="title" content="${escapeHtml(title)}" />
    <meta name="description" content="${escapeHtml(description)}" />
${keywordsBlock ? `${keywordsBlock}\n` : ''}    <meta name="robots" content="${escapeHtml(robots)}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
${googleVerification}${bingVerification}${hreflangBlock ? `${hreflangBlock}\n` : ''}    <meta property="og:type" content="${escapeHtml(page.ogType || 'website')}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:title" content="${escapeHtml(ogTitle)}" />
    <meta property="og:description" content="${escapeHtml(ogDescription)}" />
${ogImageTag}    <meta property="og:site_name" content="${escapeHtml(siteName)}" />
    <meta property="og:locale" content="${ogLocale}" />
    <meta name="twitter:card" content="${escapeHtml(twitterCard)}" />
${twitterSite ? `    <meta name="twitter:site" content="${escapeHtml(twitterSite)}" />\n` : ''}    <meta name="twitter:url" content="${escapeHtml(canonical)}" />
    <meta name="twitter:title" content="${escapeHtml(twitterTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(twitterDescription)}" />
${page.publishedAt ? `    <meta property="article:published_time" content="${escapeHtml(new Date(page.publishedAt).toISOString())}" />\n` : ''}${page.modifiedAt ? `    <meta property="article:modified_time" content="${escapeHtml(new Date(page.modifiedAt).toISOString())}" />\n` : ''}${articleTags ? `${articleTags}\n` : ''}${jsonLdBlock ? `${jsonLdBlock}\n` : ''}    <meta name="prerender-status" content="ok" />`;
}

function renderCrawlerBody(page) {
  const title = page.title || page.metaTitle || '';
  const intro = page.excerpt || page.metaDescription || page.description || '';
  const paragraphs = (page.bodyParagraphs || []).map(stripHtml).filter(Boolean);

  if (!title && !intro && !paragraphs.length) return '';

  const paras = paragraphs
    .slice(0, 8)
    .map((p) => `      <p>${escapeHtml(p)}</p>`)
    .join('\n');

  return `
    <div id="prerender-crawler-content" aria-hidden="true" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">
      <h1>${escapeHtml(title)}</h1>
      ${intro ? `<p>${escapeHtml(intro)}</p>` : ''}
${paras}
    </div>`;
}

function injectPrerenderIntoTemplate(templateHtml, page, siteSettings) {
  const headBlock = renderPrerenderHead(page, siteSettings);
  const crawlerBody = renderCrawlerBody(page);
  const lang = page.language || 'en';

  let html = templateHtml;

  html = html.replace(/<html[^>]*>/i, `<html lang="${escapeHtml(lang)}">`);
  html = html.replace(/<title>[\s\S]*?<\/title>/gi, '');
  html = html.replace(/<meta\s+name="description"[^>]*>/gi, '');
  html = html.replace(/<meta\s+name="google-site-verification"[^>]*>/gi, '');
  html = html.replace(/<head[^>]*>/i, (match) => `${match}\n${headBlock}`);

  if (crawlerBody) {
    html = html.replace(
      /<div id="root"><\/div>/i,
      `<div id="root">${crawlerBody}</div>`
    );
  }

  return html;
}

module.exports = {
  STATIC_PAGES,
  LANG_PREFERRED_REGION,
  pathForRegion,
  absUrl,
  escapeHtml,
  stripHtml,
  renderPrerenderHead,
  renderCrawlerBody,
  injectPrerenderIntoTemplate,
};
