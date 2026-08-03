const {
  resolveArticleContentForRegion,
  preferredRegionForLanguage,
} = require('./regionalContent');
const { getSlugForRegion } = require('./regionSlug');

const formatPopulatedAuthor = (author, language) => {
  if (!author) return null;
  if (typeof author === 'string') return null;
  const base = author.toObject ? author.toObject() : { ...author };
  if (!base.name && !base._id) return null;
  let slug = base.slug || base.baseSlug;
  if (typeof author.getTranslation === 'function') {
    const tr = author.getTranslation(language);
    if (tr?.slug) slug = tr.slug;
  }
  return {
    _id: base._id,
    name: base.name || 'Author',
    slug,
    avatar: base.avatar,
  };
};

const getTranslationAuthorId = (translation) => {
  if (!translation?.author) return null;
  return String(translation.author._id || translation.author);
};

/**
 * Prefer locale translation author when set; otherwise article-level author.
 * When a regional override is present, prefer its author field.
 */
const resolveArticleAuthor = (article, language, authorMap = {}, regionCode = null) => {
  let translation = null;
  if (regionCode) {
    translation = resolveArticleContentForRegion(article, regionCode).translation;
  }
  if (!translation) {
    translation =
      (typeof article.getTranslation === 'function'
        ? article.getTranslation(language)
        : article.translations?.[language]) || null;
  }
  const trAuthorId = getTranslationAuthorId(translation);
  if (trAuthorId) {
    if (translation.author?.name) {
      return formatPopulatedAuthor(translation.author, language);
    }
    if (authorMap[trAuthorId]) {
      return formatPopulatedAuthor(authorMap[trAuthorId], language);
    }
  }
  return formatPopulatedAuthor(article.author, language);
};

const collectTranslationAuthorIds = (articles) => {
  const list = Array.isArray(articles) ? articles : [articles];
  const ids = new Set();
  list.forEach((article) => {
    if (!article) return;
    let trs = article.translations;
    if (trs) {
      if (typeof trs.toObject === 'function') trs = trs.toObject();
      Object.values(trs).forEach((tr) => {
        const id = getTranslationAuthorId(tr);
        if (id) ids.add(id);
      });
    }
    let regional = article.regionalTranslations;
    if (regional) {
      if (regional instanceof Map) {
        regional.forEach((tr) => {
          const id = getTranslationAuthorId(tr);
          if (id) ids.add(id);
        });
      } else if (typeof regional === 'object') {
        Object.values(regional).forEach((tr) => {
          const id = getTranslationAuthorId(tr);
          if (id) ids.add(id);
        });
      }
    }
  });
  return [...ids];
};

const formatPopulatedCategory = (category, language) => {
  if (!category) return null;
  if (typeof category === 'string') return null;
  const base = category.toObject ? category.toObject() : { ...category };
  let slug = base.slug || base.baseSlug;
  let name = base.name;
  let description = base.description;
  if (typeof category.getTranslation === 'function') {
    const tr = category.getTranslation(language);
    if (tr) {
      if (tr.slug) slug = tr.slug;
      if (tr.name) name = tr.name;
      if (tr.description) description = tr.description;
    }
  }
  return {
    _id: base._id,
    name: name || 'Category',
    slug,
    color: base.color,
    description,
  };
};

/**
 * Mongo filter: article must have a non-empty title in the requested language.
 */
const translationTitleFilter = (language) => {
  const lang = String(language || 'en').toLowerCase();
  return {
    [`translations.${lang}.title`]: { $exists: true, $type: 'string', $regex: /\S/ },
  };
};

const FALLBACK_LISTING_LANGUAGE = 'en';

/**
 * Prefer the requested locale when it has at least one article; otherwise fall back to English.
 * Use on public listing endpoints (home, trending, category feeds, etc.).
 */
const resolveListingLanguage = async (Model, baseQuery = {}, requestedLanguage = 'en') => {
  const requested = String(requestedLanguage || FALLBACK_LISTING_LANGUAGE).toLowerCase();
  const fallback = FALLBACK_LISTING_LANGUAGE;

  if (requested === fallback) {
    return { language: requested, usedFallback: false };
  }

  const localeCount = await Model.countDocuments({
    ...baseQuery,
    ...translationTitleFilter(requested),
  });

  if (localeCount > 0) {
    return { language: requested, usedFallback: false };
  }

  return { language: fallback, usedFallback: true };
};

/** Exact translation only — no default-language fallback. */
const getExactTranslation = (article, language) => {
  if (!article) return null;
  const lang = String(language || 'en').toLowerCase();
  let tr = article.translations?.[lang];
  if (!tr) return null;
  if (typeof tr.toObject === 'function') tr = tr.toObject();
  if (!tr?.title || !String(tr.title).trim()) return null;
  return tr;
};

const transformArticleForPublic = (article, language, authorMap = {}, region = null) => {
  // Listings must show the requested locale only (no silent fallback to default language).
  const regionCode = region || preferredRegionForLanguage(language);
  const resolved = resolveArticleContentForRegion(article, regionCode);
  const activeTranslation =
    resolved.isRegionalOverride && resolved.translation
      ? resolved.translation
      : getExactTranslation(article, language);

  if (!activeTranslation) {
    return null;
  }

  const slug = getSlugForRegion(article, regionCode) || activeTranslation.slug;

  return {
    _id: article._id,
    baseSlug: article.baseSlug,
    slug,
    title: activeTranslation.title,
    excerpt: activeTranslation.excerpt,
    content: activeTranslation.content,
    imageUrl: article.imageUrl,
    imageAlt: activeTranslation.imageAlt || article.imageAlt || '',
    category: formatPopulatedCategory(article.category, language),
    author: resolveArticleAuthor(article, language, authorMap, regionCode),
    tags: article.tags,
    publishedAt: article.publishedAt,
    views: article.views,
    likes: article.likes,
    readTime: article.readTime,
    commentCount: article.commentCount || 0,
    featured: article.featured,
    trending: article.trending,
    language,
  };
};

module.exports = {
  formatPopulatedAuthor,
  formatPopulatedCategory,
  transformArticleForPublic,
  resolveArticleAuthor,
  collectTranslationAuthorIds,
  getTranslationAuthorId,
  translationTitleFilter,
  getExactTranslation,
  resolveListingLanguage,
  FALLBACK_LISTING_LANGUAGE,
};
