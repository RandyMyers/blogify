const { analyzeContentSeo } = require('./contentSeoAnalyzer');
const { getOrCreateSeoSettings } = require('../controllers/seoSettingsController');

const DEFAULT_CONTENT_SEO = {
  minPublishScore: 0,
  warnPublishScore: 60,
  requireFocusKeyword: false,
  requireMetaOnPublish: true,
  requireCanonicalOnPublish: true,
};

const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];

function getDefaultTranslation(body) {
  const lang = body.defaultLanguage || 'en';
  const tr = body.translations?.[lang] || {};
  return { lang, tr };
}

function buildAnalyzerInput(body, siteUrl) {
  const { tr } = getDefaultTranslation(body);
  const lang = body.defaultLanguage || 'en';
  return {
    focusKeyword: tr.focusKeyword,
    title: tr.title || body.title || '',
    slug: tr.slug || body.baseSlug || '',
    baseSlug: body.baseSlug || '',
    excerpt: tr.excerpt || body.excerpt || '',
    metaTitle: tr.metaTitle || '',
    metaDescription: tr.metaDescription || '',
    content: tr.content || body.content || [],
    imageAlt: tr.imageAlt || body.imageAlt || '',
    siteUrl: siteUrl || process.env.CLIENT_URL || 'https://bloomwik.com',
    tags: body.tags || [],
    categoryName: body.categoryName || '',
    authorName: body.authorName || '',
    siteArticles: body.siteArticles,
  };
}

function buildAnalyzerInputFromArticle(article, lang) {
  const useLang = lang || article.defaultLanguage || 'en';
  const tr =
    article.translations?.[useLang]?.toObject?.() ||
    article.translations?.[useLang] ||
    {};

  return {
    focusKeyword: tr.focusKeyword,
    title: tr.title || article.title || '',
    slug: tr.slug || article.baseSlug || '',
    baseSlug: article.baseSlug || '',
    excerpt: tr.excerpt || article.excerpt || '',
    metaTitle: tr.metaTitle || '',
    metaDescription: tr.metaDescription || '',
    content: tr.content || article.content || [],
    imageAlt: tr.imageAlt || article.imageAlt || '',
    siteUrl: process.env.CLIENT_URL || 'https://bloomwik.com',
    tags: article.tags || [],
  };
}

function analyzeArticlePayload(body, siteUrl) {
  return analyzeContentSeo(buildAnalyzerInput(body, siteUrl));
}

function analyzeArticleDocument(article, siteUrl) {
  return analyzeContentSeo({
    ...buildAnalyzerInputFromArticle(article),
    siteUrl: siteUrl || process.env.CLIENT_URL || 'https://bloomwik.com',
  });
}

async function validatePublishSeo(body, tenantId) {
  const settings = await getOrCreateSeoSettings(tenantId);
  const contentSeo = { ...DEFAULT_CONTENT_SEO, ...(settings.contentSeo || {}) };
  const siteUrl = settings.siteUrl;
  const analysis = analyzeArticlePayload(body, siteUrl);
  const { tr, lang: defaultLang } = getDefaultTranslation(body);
  const errors = [];

  if (contentSeo.requireMetaOnPublish) {
    if (!tr.title?.trim()) errors.push('Default locale title is required to publish.');
    if (!tr.excerpt?.trim()) errors.push('Excerpt is required to publish.');
    if (!tr.metaTitle?.trim()) errors.push('Meta title is required to publish.');
    if (!tr.metaDescription?.trim()) errors.push('Meta description is required to publish.');
    if (!body.imageAlt?.trim()) errors.push('Featured image alt text is required to publish.');

    SUPPORTED_LANGUAGES.forEach((locale) => {
      const t = body.translations?.[locale];
      if (!t?.title?.trim() || locale === defaultLang) return;
      const label = locale.toUpperCase();
      if (!t.excerpt?.trim()) errors.push(`${label}: excerpt is required to publish.`);
      if (!t.metaTitle?.trim()) errors.push(`${label}: meta title is required to publish.`);
      if (!t.metaDescription?.trim()) errors.push(`${label}: meta description is required to publish.`);
    });
  }

  if (contentSeo.requireCanonicalOnPublish) {
    SUPPORTED_LANGUAGES.forEach((locale) => {
      const t = body.translations?.[locale];
      if (!t?.title?.trim()) return;
      if (!t.canonicalUrl?.trim()) {
        errors.push(`${locale.toUpperCase()}: canonical URL is required to publish.`);
      }
    });
  }

  if (contentSeo.requireFocusKeyword && !tr.focusKeyword?.trim()) {
    errors.push('Focus keyword is required to publish.');
  }

  const minScore = Number(contentSeo.minPublishScore) || 0;
  if (minScore > 0 && analysis.score < minScore) {
    errors.push(
      `SEO score ${analysis.score} is below the minimum ${minScore} required to publish.`
    );
  }

  return { errors, analysis, contentSeo };
}

function applySeoScoreToDocument(article, siteUrl) {
  const analysis = analyzeArticleDocument(article, siteUrl);
  article.seoScore = analysis.score;
  article.seoScoreUpdatedAt = new Date();
  return analysis;
}

module.exports = {
  DEFAULT_CONTENT_SEO,
  buildAnalyzerInput,
  analyzeArticlePayload,
  analyzeArticleDocument,
  validatePublishSeo,
  applySeoScoreToDocument,
};
