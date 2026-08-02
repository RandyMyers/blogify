const Article = require('../models/Article');
const Category = require('../models/Category');
const Author = require('../models/Author');
const Region = require('../models/Region');
const { getOrCreateSeoSettings } = require('../utils/seoSettingsStore');
const { buildTranslationSeo, normalizeKeywordList } = require('./translationSeo');
const {
  STATIC_PAGES,
  pathForRegion,
  absUrl,
  stripHtml,
} = require('./prerenderMeta');
const { buildArticleHreflangLinks, buildTranslationEntityHreflangLinks, buildArticleHreflangRegions, buildStaticHreflangLinks } = require('./regionSlug');

function getSlugForLang(entity, lang) {
  const tr = entity.translations?.[lang];
  if (tr?.slug) return tr.slug;
  const def = entity.defaultLanguage || 'en';
  if (entity.translations?.[def]?.slug) return entity.translations[def].slug;
  return entity.baseSlug || entity.slug;
}

function buildStaticHreflang(siteUrl, regions, pagePath, includeRegionalVariants = true) {
  return buildStaticHreflangLinks(regions, {
    siteUrl,
    pagePath,
    includeRegionalVariants,
    pathForRegion,
    absUrlFn: absUrl,
  });
}

function articleAvailableInRegion(article, regionCode) {
  const code = (regionCode || 'US').toUpperCase();
  if (article.isGlobal) return true;
  const restrictions = article.regionRestrictions || [];
  if (!restrictions.length) return true;
  return restrictions.map((r) => String(r).toUpperCase()).includes(code);
}

function buildArticleJsonLd(siteUrl, article, translation, language, pagePath, categoryName, authorName, keywords = []) {
  const canonical = translation?.canonicalUrl || absUrl(siteUrl, pagePath);
  const keywordList = (Array.isArray(keywords) ? keywords : [])
    .map((k) => String(k || '').trim())
    .filter(Boolean);
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
    ...(keywordList.length ? { keywords: keywordList.join(', ') } : {}),
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
  const includeRegionalVariants = settings.hreflang?.includeRegionalVariants !== false;
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
        hreflang: buildStaticHreflang(siteUrl, regions, staticPage.path, includeRegionalVariants),
      });
    });
  });

  articles.forEach((article) => {
    const hreflangRegions = buildArticleHreflangRegions(article, regions, includeRegionalVariants);
    const articleHreflangOpts = {
      siteUrl,
      includeRegionalVariants,
      pathBuilder: (rc, s) => pathForRegion(rc, `/article/${s}`),
      absUrlFn: absUrl,
    };

    Object.entries(hreflangRegions).forEach(([regionCode, info]) => {
      if (!articleAvailableInRegion(article, regionCode)) return;

      const lang = info.language;
      const translation = article.translations?.[lang];
      if (!translation?.title) return;

      const slug = info.slug;
      const pagePath = pathForRegion(regionCode, `/article/${slug}`);
      const seo = buildTranslationSeo(translation, {
        siteUrl,
        regionCode,
        slug,
      });
      const categoryName = article.category?.name || '';
      const authorName = article.author?.name || '';
      const pageKeywords = normalizeKeywordList(seo.keywords);

      const hreflang = buildArticleHreflangLinks(article, regions, articleHreflangOpts);

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
        keywords: pageKeywords,
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
          authorName,
          pageKeywords
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
        hreflang: buildTranslationEntityHreflangLinks(category, regions, {
          siteUrl,
          includeRegionalVariants,
          pathBuilder: (rc, s) => pathForRegion(rc, `/category/${s}`),
          absUrlFn: absUrl,
        }),
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
        hreflang: buildStaticHreflang(siteUrl, regions, `/author/${slug}`, includeRegionalVariants),
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
