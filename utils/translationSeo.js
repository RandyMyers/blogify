function buildTranslationSeo(translation) {
  return {
    metaTitle: translation?.metaTitle || '',
    metaDescription: translation?.metaDescription || '',
    keywords: translation?.keywords || [],
    focusKeyword: translation?.focusKeyword || '',
    canonicalUrl: translation?.canonicalUrl || '',
    robots: translation?.robots || 'index,follow',
    ogImage: translation?.ogImage || '',
    ogTitle: translation?.ogTitle || '',
    ogDescription: translation?.ogDescription || '',
    twitterTitle: translation?.twitterTitle || '',
    twitterDescription: translation?.twitterDescription || '',
  };
}

module.exports = { buildTranslationSeo };
