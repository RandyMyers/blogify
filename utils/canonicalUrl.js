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
  if (trimmed) return trimmed;

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
  resolveTranslationCanonical,
  applyCanonicalUrlsToPayload,
};
