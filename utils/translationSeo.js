const { resolveCanonicalForArticle } = require('./canonicalUrl');

function buildTranslationSeo(translation, options = {}) {
  const { siteUrl, regionCode, slug } = options;
  let canonicalUrl = translation?.canonicalUrl || '';

  if (siteUrl && slug) {
    canonicalUrl = resolveCanonicalForArticle({
      stored: canonicalUrl,
      siteUrl,
      regionCode: regionCode || 'US',
      slug,
    });
  }

  return {
    metaTitle: translation?.metaTitle || '',
    metaDescription: translation?.metaDescription || '',
    keywords: translation?.keywords || [],
    focusKeyword: translation?.focusKeyword || '',
    canonicalUrl,
    robots: translation?.robots || 'index,follow',
    ogImage: translation?.ogImage || '',
    ogTitle: translation?.ogTitle || '',
    ogDescription: translation?.ogDescription || '',
    twitterTitle: translation?.twitterTitle || '',
    twitterDescription: translation?.twitterDescription || '',
  };
}

module.exports = { buildTranslationSeo };
