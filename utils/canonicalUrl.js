const LANG_PREFERRED_REGION = {
  en: 'US',
  fr: 'FR',
  de: 'DE',
  es: 'ES',
  it: 'IT',
  pt: 'PT',
  sv: 'SE',
  fi: 'FI',
  da: 'DK',
  no: 'NO',
  nl: 'NL',
};

function normalizeSiteUrl(siteUrl) {
  return String(siteUrl || 'https://bloomwik.com').replace(/\/$/, '');
}

/**
 * Build the public path for an article in a given language (region-prefixed).
 */
function buildArticlePath(lang, slug, defaultLanguage = 'en') {
  const normalizedLang = String(lang || 'en').toLowerCase();
  const region = LANG_PREFERRED_REGION[normalizedLang] || 'US';
  const regionCode = region.toLowerCase();

  if (regionCode === 'us') {
    return `/article/${slug}`;
  }
  return `/${regionCode}/article/${slug}`;
}

function buildArticleCanonicalUrl(siteUrl, lang, slug, defaultLanguage = 'en') {
  const base = normalizeSiteUrl(siteUrl);
  return `${base}${buildArticlePath(lang, slug, defaultLanguage)}`;
}

function buildArticleCanonicalUrlForRegion(siteUrl, regionCode, slug) {
  const base = normalizeSiteUrl(siteUrl);
  const code = String(regionCode || 'US').toUpperCase();
  const encoded = encodeURIComponent(String(slug || '').trim());
  if (!encoded) return '';
  const path = code === 'US' ? `/article/${encoded}` : `/${code.toLowerCase()}/article/${encoded}`;
  return `${base}${path}`;
}

/**
 * Prefer a computed article URL when a stored canonical is on our site but missing /article/.
 */
function resolveCanonicalForArticle({ stored, siteUrl, regionCode = 'US', slug }) {
  const computed = buildArticleCanonicalUrlForRegion(siteUrl, regionCode, slug);
  if (!computed) return String(stored || '').trim();

  const trimmed = String(stored || '').trim();
  if (!trimmed) return computed;

  try {
    const storedUrl = new URL(trimmed);
    const computedUrl = new URL(computed);
    if (
      storedUrl.origin === computedUrl.origin &&
      !storedUrl.pathname.includes('/article/')
    ) {
      return computed;
    }
  } catch {
    return computed;
  }

  return trimmed;
}

function normalizeManualCanonical(stored, siteUrl, regionCode, slug) {
  return resolveCanonicalForArticle({ stored, siteUrl, regionCode, slug });
}

/**
 * Resolve canonical for a translation. Non-default locales default to the
 * default-language master URL unless manually overridden.
 */
function resolveTranslationCanonical({
  lang,
  slug,
  defaultLanguage,
  defaultSlug,
  siteUrl,
  manualCanonical,
}) {
  const trimmed = String(manualCanonical || '').trim();
  if (trimmed) {
    return normalizeManualCanonical(trimmed, siteUrl, LANG_PREFERRED_REGION[defLang] || 'US', masterSlug);
  }

  const defLang = defaultLanguage || 'en';
  const masterSlug = defaultSlug || slug;

  if (String(lang).toLowerCase() === String(defLang).toLowerCase()) {
    return buildArticleCanonicalUrl(siteUrl, defLang, masterSlug, defLang);
  }

  return buildArticleCanonicalUrl(siteUrl, defLang, masterSlug, defLang);
}

/**
 * Apply canonical URLs to all translations in a payload before save.
 */
function applyCanonicalUrlsToPayload(payload, siteUrl) {
  const defaultLang = payload.defaultLanguage || 'en';
  const defaultT = payload.translations?.[defaultLang];
  const defaultSlug = defaultT?.slug || payload.baseSlug || payload.slug;

  if (!defaultSlug || !payload.translations) return payload;

  const base = normalizeSiteUrl(siteUrl);
  Object.keys(payload.translations).forEach((lang) => {
    const t = payload.translations[lang];
    if (!t?.title?.trim()) return;
    const slug = t.slug || defaultSlug;
    t.canonicalUrl = resolveTranslationCanonical({
      lang,
      slug,
      defaultLanguage: defaultLang,
      defaultSlug,
      siteUrl: base,
      manualCanonical: t.canonicalUrl,
    });
  });

  return payload;
}

module.exports = {
  LANG_PREFERRED_REGION,
  buildArticlePath,
  buildArticleCanonicalUrl,
  buildArticleCanonicalUrlForRegion,
  resolveCanonicalForArticle,
  normalizeManualCanonical,
  resolveTranslationCanonical,
  applyCanonicalUrlsToPayload,
};
