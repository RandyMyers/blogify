const { LANG_PREFERRED_REGION } = require('./canonicalUrl');
const { DEFAULT_REGION_LANGUAGES, REGION_CODES } = require('../constants/regions');
const {
  getRegionalTranslation,
  hasRegionalTranslation,
  normalizeRegionalTranslationsMap,
} = require('./regionalContent');

const SUPPORTED_LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];

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

  const regional = getRegionalTranslation(article, code);
  if (regional?.slug) return regional.slug;

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

  Object.values(normalizeRegionalTranslationsMap(article?.regionalTranslations)).forEach((block) => {
    if (block?.slug) slugs.add(block.slug);
  });

  return slugs;
}

function hasTranslation(entity, lang) {
  const l = String(lang || '').toLowerCase();
  const title = entity?.translations?.[l]?.title;
  return Boolean(title && String(title).trim());
}

function articleAvailableInRegion(article, regionCode) {
  const code = normalizeRegionCode(regionCode);
  if (article?.isGlobal) return true;
  const restrictions = article?.regionRestrictions || [];
  if (!restrictions.length) return true;
  return restrictions.map((r) => String(r).toUpperCase()).includes(code);
}

/** Slug for hreflang only — no fallback to another language's slug. */
function getHreflangSlugForRegion(article, regionCode) {
  if (!article) return '';
  const code = normalizeRegionCode(regionCode);
  const explicit = normalizeRegionSlugMap(article.regionSlugs)[code];
  if (explicit) return explicit;

  const regional = getRegionalTranslation(article, code);
  if (regional?.slug) return regional.slug;

  const lang = languageForRegion(code, article);
  const preferred = LANG_PREFERRED_REGION[lang] || 'US';
  if (code !== preferred) return '';
  if (!hasTranslation(article, lang)) return '';

  return article.translations?.[lang]?.slug || '';
}

function hreflangTagForEntry(lang, regionCode, includeRegionalVariants) {
  const l = String(lang || 'en').toLowerCase();
  const code = normalizeRegionCode(regionCode).toLowerCase();
  return includeRegionalVariants ? `${l}-${code}` : l;
}

function shouldEmitArticleHreflang(hreflangRegions, article) {
  const entries = Object.entries(hreflangRegions);
  if (entries.length === 0) return false;
  if (entries.length >= 2) return true;

  const languages = new Set(entries.map(([, info]) => info.language));
  if (languages.size > 1) return true;

  const explicitSlugs = normalizeRegionSlugMap(article?.regionSlugs);
  const hasSecondaryExplicit = Object.keys(explicitSlugs).some((code) => {
    const lang = languageForRegion(code, article);
    const preferred = LANG_PREFERRED_REGION[lang] || 'US';
    return normalizeRegionCode(code) !== preferred;
  });
  if (hasSecondaryExplicit) return true;

  const regional = normalizeRegionalTranslationsMap(article?.regionalTranslations);
  return Object.keys(regional).some((code) => {
    const lang = languageForRegion(code, article);
    const preferred = LANG_PREFERRED_REGION[lang] || 'US';
    return normalizeRegionCode(code) !== preferred;
  });
}

/**
 * Regions that qualify for article hreflang alternates.
 * Includes a market when:
 * - it is the preferred region for that language (e.g. US for English), or
 * - it has a regional content override (e.g. Canada-localized English), or
 * - an explicit country slug was saved in admin (e.g. CA for en-CA).
 */
function buildArticleHreflangRegions(article, regions = [], includeRegionalVariants = true) {
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
      if (!articleAvailableInRegion(article, code)) return;

      const lang = String(region.defaultLanguage || languageForRegion(code, article)).toLowerCase();
      const preferred = LANG_PREFERRED_REGION[lang] || 'US';
      const hasRegional = hasRegionalTranslation(article, code);
      const explicitSlug = normalizeRegionSlugMap(article?.regionSlugs)[code];

      if (!hasRegional && !hasTranslation(article, lang)) return;
      if (!hasRegional && !explicitSlug && code !== preferred) return;

      const slug = getHreflangSlugForRegion(article, code);
      if (!slug) return;

      result[code] = {
        slug,
        language: lang,
        hreflang: hreflangTagForEntry(lang, code, includeRegionalVariants),
      };
    });

  return result;
}

function buildAvailableRegions(article, regions = [], includeRegionalVariants = true) {
  return buildArticleHreflangRegions(article, regions, includeRegionalVariants);
}

function buildTranslationEntityHreflangRegions(entity, regions = [], includeRegionalVariants = true) {
  const result = {};

  SUPPORTED_LANGUAGES.forEach((lang) => {
    if (!hasTranslation(entity, lang)) return;
    const slug = entity.translations?.[lang]?.slug;
    if (!slug) return;

    const preferred = LANG_PREFERRED_REGION[lang] || 'US';
    result[preferred] = {
      slug,
      language: lang,
      hreflang: hreflangTagForEntry(lang, preferred, includeRegionalVariants),
    };
  });

  return result;
}

function buildHreflangLinksFromRegions(
  hreflangRegions,
  { siteUrl, pathBuilder, absUrlFn, defaultLanguage = 'en', emitCluster = true }
) {
  if (!emitCluster) return [];

  const links = [];
  const seen = new Set();

  Object.entries(hreflangRegions).forEach(([code, info]) => {
    const regionCode = normalizeRegionCode(code);
    const tag = info.hreflang;
    if (!tag || seen.has(tag)) return;
    seen.add(tag);
    links.push({
      lang: tag,
      href: absUrlFn(siteUrl, pathBuilder(regionCode, info.slug)),
    });
  });

  const preferred = LANG_PREFERRED_REGION[defaultLanguage] || 'US';
  const defaultInfo = hreflangRegions[preferred] || Object.values(hreflangRegions)[0];
  if (defaultInfo?.slug) {
    links.push({
      lang: 'x-default',
      href: absUrlFn(siteUrl, pathBuilder(preferred, defaultInfo.slug)),
    });
  }

  return links;
}

function buildArticleHreflangLinks(article, regions, { siteUrl, includeRegionalVariants = true, pathBuilder, absUrlFn }) {
  const hreflangRegions = buildArticleHreflangRegions(article, regions, includeRegionalVariants);
  return buildHreflangLinksFromRegions(hreflangRegions, {
    siteUrl,
    pathBuilder,
    absUrlFn,
    defaultLanguage: article?.defaultLanguage || 'en',
    emitCluster: shouldEmitArticleHreflang(hreflangRegions, article),
  });
}

function buildTranslationEntityHreflangLinks(entity, regions, { siteUrl, includeRegionalVariants = true, pathBuilder, absUrlFn }) {
  const hreflangRegions = buildTranslationEntityHreflangRegions(entity, regions, includeRegionalVariants);
  const langCount = new Set(Object.values(hreflangRegions).map((r) => r.language)).size;
  return buildHreflangLinksFromRegions(hreflangRegions, {
    siteUrl,
    pathBuilder,
    absUrlFn,
    defaultLanguage: entity?.defaultLanguage || 'en',
    emitCluster: langCount >= 2,
  });
}

/**
 * Hreflang for static/list pages — one entry per active country market (all ~18 locales).
 */
function buildStaticHreflangLinks(regions = [], opts = {}) {
  const {
    siteUrl,
    pagePath = '/',
    includeRegionalVariants = true,
    pathForRegion,
    absUrlFn,
  } = opts;

  if (typeof pathForRegion !== 'function' || typeof absUrlFn !== 'function') {
    return [];
  }

  const normalizedPath =
    pagePath === '/' || !pagePath ? '/' : pagePath.startsWith('/') ? pagePath : `/${pagePath}`;

  const source = (regions || []).filter((region) => region?.isActive !== false);
  const activeRegions = source.length
    ? source
    : Object.keys(DEFAULT_REGION_LANGUAGES).map((code) => ({
        code,
        defaultLanguage: DEFAULT_REGION_LANGUAGES[code],
        isActive: true,
      }));

  const links = [];
  const seen = new Set();

  activeRegions.forEach((region) => {
    const code = normalizeRegionCode(region.code);
    const lang = String(region.defaultLanguage || languageForRegion(code) || 'en').toLowerCase();
    const tag = includeRegionalVariants
      ? hreflangTagForEntry(lang, code, true)
      : lang;

    if (!includeRegionalVariants) {
      const preferred = LANG_PREFERRED_REGION[lang] || 'US';
      if (code !== preferred || seen.has(lang)) return;
      seen.add(lang);
    } else if (seen.has(tag)) {
      return;
    } else {
      seen.add(tag);
    }

    links.push({
      lang: tag,
      href: absUrlFn(siteUrl, pathForRegion(code, normalizedPath)),
    });
  });

  links.push({
    lang: 'x-default',
    href: absUrlFn(siteUrl, pathForRegion('US', normalizedPath)),
  });

  return links;
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
  hasTranslation,
  articleAvailableInRegion,
  getHreflangSlugForRegion,
  buildArticleHreflangRegions,
  buildTranslationEntityHreflangRegions,
  buildArticleHreflangLinks,
  buildTranslationEntityHreflangLinks,
  buildStaticHreflangLinks,
  buildAvailableRegions,
  sanitizeRegionSlugsInput,
  hasRegionalTranslation,
  getRegionalTranslation,
};
