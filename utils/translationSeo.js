const { resolveCanonicalForArticle } = require('./canonicalUrl');

/**
 * Normalize keywords from admin/API/mongoose into a plain unique string[].
 * Only values explicitly provided — never invent or merge fallback sources.
 */
function normalizeKeywordList(...sources) {
  const out = [];
  const seen = new Set();

  const pushOne = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(value);
  };

  sources.forEach((source) => {
    if (source == null || source === false) return;

    if (typeof source === 'string') {
      source.split(',').forEach(pushOne);
      return;
    }

    if (Array.isArray(source)) {
      source.forEach(pushOne);
      return;
    }

    // Mongoose DocumentArray / array-like
    if (typeof source === 'object' && typeof source.forEach === 'function') {
      source.forEach(pushOne);
      return;
    }

    pushOne(source);
  });

  return out;
}

function plainTranslation(translation) {
  if (!translation) return null;
  if (typeof translation.toObject === 'function') {
    return translation.toObject({ depopulate: true });
  }
  return translation;
}

function normalizePublicRobots(robots) {
  const parts = String(robots || 'index,follow')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  // Public article responses must remain indexable even if admin left noindex set.
  if (!parts.length || parts.includes('noindex')) {
    return 'index, follow';
  }

  const follow = parts.includes('nofollow') ? 'nofollow' : 'follow';
  return `index, ${follow}`;
}

/**
 * Build public SEO from the active locale translation only.
 * Keywords / metaTitle / metaDescription never fall back to tags or other locales.
 */
function buildTranslationSeo(translation, options = {}) {
  const { siteUrl, regionCode, slug, forceIndexable = true } = options;
  const tr = plainTranslation(translation) || {};
  let canonicalUrl = tr.canonicalUrl || '';

  if (siteUrl && slug) {
    canonicalUrl = resolveCanonicalForArticle({
      stored: canonicalUrl,
      siteUrl,
      regionCode: regionCode || 'US',
      slug,
    });
  }

  const robots = forceIndexable
    ? normalizePublicRobots(tr.robots)
    : String(tr.robots || 'index,follow').replace(/,/g, ', ').replace(/\s+/g, ' ').trim();

  return {
    metaTitle: tr.metaTitle || '',
    metaDescription: tr.metaDescription || '',
    keywords: normalizeKeywordList(tr.keywords),
    focusKeyword: tr.focusKeyword || '',
    canonicalUrl,
    robots,
    ogImage: tr.ogImage || '',
    ogTitle: tr.ogTitle || '',
    ogDescription: tr.ogDescription || '',
    twitterTitle: tr.twitterTitle || '',
    twitterDescription: tr.twitterDescription || '',
  };
}

module.exports = {
  buildTranslationSeo,
  normalizeKeywordList,
  normalizePublicRobots,
};
