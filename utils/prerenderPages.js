const Article = require('../models/Article');
const Category = require('../models/Category');
const Author = require('../models/Author');
const Region = require('../models/Region');
const { getOrCreateSeoSettings } = require('../utils/seoSettingsStore');
const { buildTranslationSeo } = require('./translationSeo');
const {
  STATIC_PAGES,
  LANG_PREFERRED_REGION,
  pathForRegion,
  absUrl,
  stripHtml,
} = require('./prerenderMeta');

function getSlugForLang(entity, lang) {
  const tr = entity.translations?.[lang];
  if (tr?.slug) return tr.slug;
  const def = entity.defaultLanguage || 'en';
  if (entity.translations?.[def]?.slug) return entity.translations[def].slug;
  return entity.baseSlug || entity.slug;
}

function buildLangToRegionMap(regions) {
  const langToRegion = {};
  (regions || []).forEach((region) => {
    const lang = (region.defaultLanguage || 'en').toLowerCase();
    const code = (region.code || '').toUpperCase();
    const preferred = LANG_PREFERRED_REGION[lang];
    if (!langToRegion[lang]) langToRegion[lang] = region;
    if (preferred && code === preferred) langToRegion[lang] = region;
  });
  return langToRegion;
}

function buildStaticHreflang(siteUrl, regions, pagePath) {
  const langToRegion = buildLangToRegionMap(regions);
  const links = Object.entries(langToRegion).map(([lang, region]) => ({
    lang,
    href: absUrl(siteUrl, pathForRegion(region.code, pagePath)),
  }));
  links.push({ lang: 'x-default', href: absUrl(siteUrl, pagePath) });
  return links;
}

function articleAvailableInRegion(article, regionCode) {
  const code = (regionCode || 'US').toUpperCase();
  if (article.isGlobal) return true;
  const restrictions = article.regionRestrictions || [];
  if (!restrictions.length) return true;
  return restrictions.map((r) => String(r).toUpperCase()).includes(code);
}

function buildHreflangForEntity(siteUrl, entity, pathBuilder) {
  const langs = new Set(Object.keys(entity.translations || {}));
  if (entity.defaultLanguage) langs.add(entity.defaultLanguage);

  const links = [];
  langs.forEach((lang) => {
    const slug = getSlugForLang(entity, lang);
    if (!slug) return;
    const region = Object.keys(LANG_PREFERRED_REGION).find((l) => l === lang);
    const regionCode = LANG_PREFERRED_REGION[lang] || 'US';
    const path = pathBuilder(regionCode, slug);
    links.push({ lang, href: absUrl(siteUrl, path) });
  });

  const defaultSlug = getSlugForLang(entity, entity.defaultLanguage || 'en');
  if (defaultSlug) {
    links.push({
      lang: 'x-default',
      href: absUrl(siteUrl, pathBuilder('US', defaultSlug)),
    });
  }
  return links;
}

function buildArticleJsonLd(siteUrl, article, translation, language, pagePath, categoryName, authorName) {
  const canonical = translation?.canonicalUrl || absUrl(siteUrl, pagePath);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: translation?.title,
    description: translation?.excerpt,
    image: article.imageUrl,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    author: {
      '@type': 'Person',
      name: authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: article.articleSchema?.publisher || 'Bloomwik',
      logo: { '@type': 'ImageObject', url: `${siteUrl}/logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    url: canonical,
    articleSection: article.articleSchema?.articleSection || categoryName,
    inLanguage: language,
  };
}

function buildCategoryJsonLd(siteUrl, category, translation, pagePath) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: translation?.name || category.name,
    description: translation?.description || category.description,
    url: absUrl(siteUrl, pagePath),
  };
}

function buildAuthorJsonLd(siteUrl, author, pagePath) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    description: author.bio,
    url: absUrl(siteUrl, pagePath),
  };
}

async function buildPrerenderPages(tenantId) {
  const settings = await getOrCreateSeoSettings(tenantId);
  const siteUrl = settings.siteUrl || process.env.CLIENT_URL || 'https://bloomwik.com';
  const siteName = settings.siteName || 'Bloomwik';
  const tenantFilter = tenantId ? { tenantId } : {};

  const [regions, articles, categories, authors] = await Promise.all([
    Region.getActive(),
    Article.find({ published: true, ...tenantFilter })
      .populate('category', 'name slug baseSlug defaultLanguage translations')
      .populate('author', 'name slug baseSlug')
      .sort({ updatedAt: -1 })
      .limit(50000),
    Category.find({}).sort({ updatedAt: -1 }).limit(50000),
    Author.find({}).sort({ updatedAt: -1 }).limit(50000),
  ]);

  const langToRegion = buildLangToRegionMap(regions);
  const pages = [];
  const seenPaths = new Set();

  const pushPage = (page) => {
    if (!page?.path || seenPaths.has(page.path)) return;
    seenPaths.add(page.path);
    pages.push(page);
  };

  STATIC_PAGES.forEach((staticPage) => {
    regions.forEach((region) => {
      const lang = (region.defaultLanguage || 'en').toLowerCase();
      const pagePath = pathForRegion(region.code, staticPage.path);
      pushPage({
        path: pagePath,
        language: lang,
        title: staticPage.title,
        metaTitle: staticPage.title,
        metaDescription: staticPage.description,
        description: staticPage.description,
        canonicalUrl: absUrl(siteUrl, pagePath),
        robots: 'index, follow',
        ogType: 'website',
        hreflang: buildStaticHreflang(siteUrl, regions, staticPage.path),
      });
    });
  });

  articles.forEach((article) => {
    regions.forEach((region) => {
      if (!articleAvailableInRegion(article, region.code)) return;

      const lang = (region.defaultLanguage || 'en').toLowerCase();
      const translation =
        typeof article.getTranslation === 'function'
          ? article.getTranslation(lang)
          : article.translations?.[lang];
      if (!translation?.title) return;

      const slug = translation.slug || article.baseSlug;
      if (!slug) return;

      const pagePath = pathForRegion(region.code, `/article/${slug}`);
      const seo = buildTranslationSeo(translation);
      const categoryName = article.category?.name || '';
      const authorName = article.author?.name || '';

      const hreflang = buildHreflangForEntity(siteUrl, article, (rc, s) =>
        pathForRegion(rc, `/article/${s}`)
      );

      const bodyParagraphs = Array.isArray(translation.content)
        ? translation.content.slice(0, 12)
        : [];

      pushPage({
        path: pagePath,
        language: lang,
        title: translation.title,
        excerpt: translation.excerpt,
        metaTitle: seo.metaTitle,
        metaDescription: seo.metaDescription,
        description: seo.metaDescription,
        keywords: [...(seo.keywords || []), seo.focusKeyword].filter(Boolean),
        canonicalUrl: seo.canonicalUrl || absUrl(siteUrl, pagePath),
        robots: (seo.robots || 'index,follow').replace(',', ', '),
        ogTitle: seo.ogTitle,
        ogDescription: seo.ogDescription,
        ogImage: seo.ogImage || article.imageUrl,
        twitterTitle: seo.twitterTitle,
        twitterDescription: seo.twitterDescription,
        twitterCard: article.twitterCard || 'summary_large_image',
        tags: article.tags || [],
        publishedAt: article.publishedAt,
        modifiedAt: article.updatedAt,
        ogType: 'article',
        hreflang,
        bodyParagraphs,
        jsonLd: buildArticleJsonLd(
          siteUrl,
          article,
          translation,
          lang,
          pagePath,
          categoryName,
          authorName
        ),
      });
    });
  });

  categories.forEach((category) => {
    regions.forEach((region) => {
      const lang = (region.defaultLanguage || 'en').toLowerCase();
      const translation =
        typeof category.getTranslation === 'function'
          ? category.getTranslation(lang)
          : category.translations?.[lang];
      if (!translation?.name && !category.name) return;

      const slug = getSlugForLang(category, lang);
      if (!slug) return;

      const pagePath = pathForRegion(region.code, `/category/${slug}`);

      pushPage({
        path: pagePath,
        language: lang,
        title: translation?.name || category.name,
        metaTitle: translation?.metaTitle || translation?.name || category.name,
        metaDescription: translation?.metaDescription || translation?.description || category.description,
        description: translation?.description || category.description,
        canonicalUrl: absUrl(siteUrl, pagePath),
        robots: 'index, follow',
        ogType: 'website',
        hreflang: buildHreflangForEntity(siteUrl, category, (rc, s) =>
          pathForRegion(rc, `/category/${s}`)
        ),
        jsonLd: buildCategoryJsonLd(siteUrl, category, translation, pagePath),
      });
    });
  });

  authors.forEach((author) => {
    const slug = author.slug || author.baseSlug;
    if (!slug || !author.name) return;

    regions.forEach((region) => {
      const lang = (region.defaultLanguage || 'en').toLowerCase();
      const pagePath = pathForRegion(region.code, `/author/${slug}`);
      pushPage({
        path: pagePath,
        language: lang,
        title: author.name,
        metaTitle: author.seo?.metaTitle || author.name,
        metaDescription: author.seo?.metaDescription || author.bio,
        description: author.bio,
        canonicalUrl: absUrl(siteUrl, pagePath),
        robots: 'index, follow',
        ogType: 'profile',
        hreflang: Object.entries(langToRegion).map(([l, r]) => ({
          lang: l,
          href: absUrl(siteUrl, pathForRegion(r.code, `/author/${slug}`)),
        })),
        bodyParagraphs: author.bio ? [author.bio] : [],
        jsonLd: buildAuthorJsonLd(siteUrl, author, pagePath),
      });
    });
  });

  return {
    siteSettings: {
      siteName,
      siteUrl,
      twitterHandle: settings.twitterHandle,
      googleSiteVerification: settings.googleSiteVerification,
      bingSiteVerification: settings.bingSiteVerification,
      hreflang: settings.hreflang,
    },
    pages,
    stats: {
      total: pages.length,
      articles: articles.length,
      categories: categories.length,
      authors: authors.length,
    },
  };
}

module.exports = { buildPrerenderPages };
