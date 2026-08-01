const { resolveCanonicalForArticle } = require('./canonicalUrl');

/**
 * Normalize keywords from admin/API/mongoose into a plain unique string[].
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

function buildTranslationSeo(translation, options = {}) {
  const { siteUrl, regionCode, slug, fallbackKeywords } = options;
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

  const ownKeywords = normalizeKeywordList(tr.keywords);
  const keywords = ownKeywords.length
    ? ownKeywords
    : normalizeKeywordList(fallbackKeywords);

  return {
    metaTitle: tr.metaTitle || '',
    metaDescription: tr.metaDescription || '',
    keywords,
    focusKeyword: tr.focusKeyword || '',
    canonicalUrl,
    robots: tr.robots || 'index,follow',
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
};
