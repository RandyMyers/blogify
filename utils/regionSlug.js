const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];

const DEFAULT_REGION_LANGUAGES = {
  US: 'en',
  GB: 'en',
  CA: 'en',
  AU: 'en',
  IE: 'en',
  FR: 'fr',
  DE: 'de',
  ES: 'es',
  IT: 'it',
  PT: 'pt',
  SE: 'sv',
  NO: 'no',
  DK: 'da',
  FI: 'fi',
  BE: 'nl',
  NL: 'nl',
  LU: 'fr',
  CH: 'de',
  AT: 'de',
};

function normalizeRegionCode(regionCode) {
  return String(regionCode || 'US').toUpperCase();
}

function normalizeRegionSlugMap(raw) {
  if (!raw) return {};
  if (raw instanceof Map) {
    const obj = {};
    raw.forEach((value, key) => {
      const slug = String(value || '').trim().toLowerCase();
      if (slug) obj[normalizeRegionCode(key)] = slug;
    });
    return obj;
  }
  if (typeof raw === 'object') {
    const obj = {};
    Object.entries(raw).forEach(([key, value]) => {
      const slug = String(value || '').trim().toLowerCase();
      if (slug) obj[normalizeRegionCode(key)] = slug;
    });
    return obj;
  }
  return {};
}

function languageForRegion(regionCode, article) {
  const code = normalizeRegionCode(regionCode);
  return DEFAULT_REGION_LANGUAGES[code] || article?.defaultLanguage || 'en';
}

function getLanguageSlug(article, lang) {
  const normalized = String(lang || '').toLowerCase();
  const translation = article?.translations?.[normalized];
  if (translation?.slug) return translation.slug;
  const def = article?.defaultLanguage || 'en';
  if (article?.translations?.[def]?.slug) return article.translations[def].slug;
  return article?.baseSlug || article?.slug || '';
}

function getSlugForRegion(article, regionCode) {
  if (!article) return '';
  const code = normalizeRegionCode(regionCode);
  const map = normalizeRegionSlugMap(article.regionSlugs);
  if (map[code]) return map[code];

  const lang = languageForRegion(code, article);
  return getLanguageSlug(article, lang);
}

function collectArticleSlugs(article) {
  const slugs = new Set();
  if (article?.baseSlug) slugs.add(article.baseSlug);
  if (article?.slug) slugs.add(article.slug);

  const translations = article?.translations || {};
  SUPPORTED_LANGUAGES.forEach((lang) => {
    const slug = translations[lang]?.slug;
    if (slug) slugs.add(slug);
  });

  Object.values(normalizeRegionSlugMap(article?.regionSlugs)).forEach((slug) => {
    if (slug) slugs.add(slug);
  });

  return slugs;
}

function buildAvailableRegions(article, regions = []) {
  const result = {};
  const source = Array.isArray(regions) && regions.length ? regions : Object.keys(DEFAULT_REGION_LANGUAGES).map((code) => ({
    code,
    defaultLanguage: DEFAULT_REGION_LANGUAGES[code],
    isActive: true,
  }));

  source
    .filter((region) => region?.isActive !== false)
    .forEach((region) => {
      const code = normalizeRegionCode(region.code);
      const slug = getSlugForRegion(article, code);
      if (!slug) return;
      result[code] = {
        slug,
        language: String(region.defaultLanguage || languageForRegion(code, article)).toLowerCase(),
      };
    });

  return result;
}

function sanitizeRegionSlugsInput(raw = {}) {
  const input = normalizeRegionSlugMap(raw);
  const cleaned = {};
  Object.entries(input).forEach(([code, slug]) => {
    const normalized = String(slug || '').trim().toLowerCase();
    if (normalized) cleaned[normalizeRegionCode(code)] = normalized;
  });
  return cleaned;
}

module.exports = {
  SUPPORTED_LANGUAGES,
  DEFAULT_REGION_LANGUAGES,
  normalizeRegionCode,
  normalizeRegionSlugMap,
  languageForRegion,
  getLanguageSlug,
  getSlugForRegion,
  collectArticleSlugs,
  buildAvailableRegions,
  sanitizeRegionSlugsInput,
};
