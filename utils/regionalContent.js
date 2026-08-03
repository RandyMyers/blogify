const { LANG_PREFERRED_REGION } = require('./canonicalUrl');
const { DEFAULT_REGION_LANGUAGES } = require('../constants/regions');

const TRANSLATION_FIELDS = [
  'slug',
  'title',
  'excerpt',
  'content',
  'metaTitle',
  'metaDescription',
  'keywords',
  'focusKeyword',
  'canonicalUrl',
  'robots',
  'ogImage',
  'ogTitle',
  'ogDescription',
  'twitterTitle',
  'twitterDescription',
  'offers',
  'author',
];

function normalizeRegionCode(regionCode) {
  return String(regionCode || 'US').toUpperCase();
}

function preferredRegionForLanguage(lang) {
  const normalized = String(lang || 'en').toLowerCase();
  return LANG_PREFERRED_REGION[normalized] || 'US';
}

function languageForRegionCode(regionCode, article) {
  const code = normalizeRegionCode(regionCode);
  return String(
    DEFAULT_REGION_LANGUAGES[code] || article?.defaultLanguage || 'en'
  ).toLowerCase();
}

function isPreferredContentRegion(regionCode, language) {
  const code = normalizeRegionCode(regionCode);
  const lang = String(language || 'en').toLowerCase();
  return code === preferredRegionForLanguage(lang);
}

function plainTranslation(raw) {
  if (!raw) return null;
  const plain = typeof raw.toObject === 'function' ? raw.toObject() : { ...raw };
  if (!plain.title || !String(plain.title).trim()) return null;
  return plain;
}

function normalizeRegionalTranslationsMap(raw) {
  if (!raw) return {};
  if (raw instanceof Map) {
    const obj = {};
    raw.forEach((value, key) => {
      const plain = plainTranslation(value);
      if (plain) obj[normalizeRegionCode(key)] = plain;
    });
    return obj;
  }
  if (typeof raw === 'object') {
    const obj = {};
    Object.entries(raw).forEach(([key, value]) => {
      const plain = plainTranslation(value);
      if (plain) obj[normalizeRegionCode(key)] = plain;
    });
    return obj;
  }
  return {};
}

function getRegionalTranslation(article, regionCode) {
  if (!article) return null;
  const code = normalizeRegionCode(regionCode);
  const map = article.regionalTranslations;
  if (!map) return null;
  const raw = typeof map.get === 'function' ? map.get(code) : map[code];
  return plainTranslation(raw);
}

function getLanguageTranslation(article, language) {
  if (!article) return null;
  const lang = String(language || 'en').toLowerCase();
  const raw = article.translations?.[lang];
  return plainTranslation(raw);
}

/**
 * Resolve the content block for a market.
 * Preferred region (US for en, FR for fr, …) uses translations[lang].
 * Other markets use regionalTranslations[code] when present, else fall back to language.
 */
function resolveArticleContentForRegion(article, regionCode) {
  const code = normalizeRegionCode(regionCode);
  const language = languageForRegionCode(code, article);
  const preferred = preferredRegionForLanguage(language);

  if (code === preferred) {
    const translation =
      getLanguageTranslation(article, language) ||
      getLanguageTranslation(article, article?.defaultLanguage);
    return {
      regionCode: code,
      language,
      isRegionalOverride: false,
      translation,
    };
  }

  const regional = getRegionalTranslation(article, code);
  if (regional) {
    return {
      regionCode: code,
      language,
      isRegionalOverride: true,
      translation: regional,
    };
  }

  const translation =
    getLanguageTranslation(article, language) ||
    getLanguageTranslation(article, article?.defaultLanguage);
  return {
    regionCode: code,
    language,
    isRegionalOverride: false,
    translation,
  };
}

function hasRegionalTranslation(article, regionCode) {
  return Boolean(getRegionalTranslation(article, regionCode));
}

function sanitizeRegionalTranslationsInput(raw = {}) {
  if (!raw || typeof raw !== 'object') return {};
  const source =
    raw instanceof Map ? Object.fromEntries(raw.entries()) : raw;
  const cleaned = {};

  Object.entries(source).forEach(([key, value]) => {
    if (!value || typeof value !== 'object') return;
    const code = normalizeRegionCode(key);
    const title = String(value.title || '').trim();
    if (!title) return;

    const entry = {
      title,
      slug: String(value.slug || '').trim().toLowerCase(),
      excerpt: String(value.excerpt || '').trim(),
      content: Array.isArray(value.content) ? value.content : [],
      metaTitle: String(value.metaTitle || '').trim(),
      metaDescription: String(value.metaDescription || '').trim(),
      keywords: Array.isArray(value.keywords)
        ? value.keywords.map((k) => String(k || '').trim()).filter(Boolean)
        : [],
      focusKeyword: String(value.focusKeyword || '').trim(),
      canonicalUrl: String(value.canonicalUrl || '').trim(),
      robots: value.robots || 'index,follow',
      ogImage: String(value.ogImage || '').trim(),
      ogTitle: String(value.ogTitle || '').trim(),
      ogDescription: String(value.ogDescription || '').trim(),
      twitterTitle: String(value.twitterTitle || '').trim(),
      twitterDescription: String(value.twitterDescription || '').trim(),
      imageAlt: String(value.imageAlt || '').trim(),
      offers: Array.isArray(value.offers) ? value.offers : [],
      author: value.author || null,
    };

    cleaned[code] = entry;
  });

  return cleaned;
}

function applyRegionalCanonicalUrls(regionalTranslations, siteUrl, buildCanonicalFn) {
  const result = { ...regionalTranslations };
  Object.entries(result).forEach(([code, t]) => {
    if (!t?.title?.trim()) return;
    if (String(t.canonicalUrl || '').trim()) return;
    const slug = t.slug || '';
    if (!slug || typeof buildCanonicalFn !== 'function') return;
    result[code] = {
      ...t,
      canonicalUrl: buildCanonicalFn(siteUrl, code, slug),
    };
  });
  return result;
}

module.exports = {
  TRANSLATION_FIELDS,
  normalizeRegionCode,
  preferredRegionForLanguage,
  languageForRegionCode,
  isPreferredContentRegion,
  plainTranslation,
  normalizeRegionalTranslationsMap,
  getRegionalTranslation,
  getLanguageTranslation,
  resolveArticleContentForRegion,
  hasRegionalTranslation,
  sanitizeRegionalTranslationsInput,
  applyRegionalCanonicalUrls,
};
