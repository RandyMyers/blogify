const Article = require('../models/Article');
const { asyncHandler } = require('./errorHandler');
const { isObjectIdString } = require('../utils/objectIdUtils');
const { getSlugForRegion } = require('../utils/regionSlug');

const AUTHOR_POPULATE = {
  path: 'author',
  select: 'name slug avatar bio baseSlug defaultLanguage translations socialLinks customLinks',
};

const CATEGORY_POPULATE = {
  path: 'category',
  select: 'name slug color baseSlug defaultLanguage translations description',
};

/**
 * Middleware to check if article is accessible in current region
 * Also handles translation fallback
 */
const checkArticleAccess = asyncHandler(async (req, res, next) => {
  const { slug } = req.params;
  const { language, region } = req;
  const tenantId = req.tenantId;

  if (!language || !region) {
    return res.status(400).json({
      success: false,
      message: 'Region and language must be detected first',
    });
  }

  const tenantClause = tenantId ? { tenantId } : {};

  const slugOr = [
    { [`regionSlugs.${region}`]: slug },
    { [`translations.${language}.slug`]: slug },
    { baseSlug: slug },
    { slug },
    { previousSlugs: slug },
  ];

  if (isObjectIdString(slug)) {
    slugOr.push({ _id: slug, ...tenantClause });
  }

  let article = await Article.findOne({
    ...tenantClause,
    $or: slugOr,
  });

  if (!article) {
    const supportedLanguages = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];
    for (const lang of supportedLanguages) {
      article = await Article.findOne({
        ...tenantClause,
        [`translations.${lang}.slug`]: slug,
      });
      if (article) break;
    }
  }

  if (!article) {
    const regionCodes = ['US', 'GB', 'CA', 'AU', 'IE', 'FR', 'DE', 'ES', 'IT', 'PT', 'SE', 'NO', 'DK', 'FI', 'BE', 'NL', 'LU', 'CH', 'AT'];
    for (const code of regionCodes) {
      article = await Article.findOne({
        ...tenantClause,
        [`regionSlugs.${code}`]: slug,
      });
      if (article) break;
    }
  }

  if (!article) {
    return res.status(404).json({
      success: false,
      message: 'Article not found',
    });
  }

  await article.populate([AUTHOR_POPULATE, CATEGORY_POPULATE]);

  if (!article.published) {
    return res.status(404).json({
      success: false,
      message: 'Article not found',
    });
  }

  if (!article.isGlobal) {
    if (!article.regionRestrictions || article.regionRestrictions.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Article not available in your region',
      });
    }

    if (!article.regionRestrictions.includes(region)) {
      const alternative = await Article.findOne({
        ...tenantClause,
        baseSlug: article.baseSlug,
        $or: [{ isGlobal: true }, { regionRestrictions: region }],
        published: true,
      });

      if (alternative) {
        const altTranslation = alternative.getTranslation(language);
        const altSlug = getSlugForRegion(alternative, region) || altTranslation?.slug || alternative.baseSlug;
        const regionPrefix = region === 'US' ? '' : `/${region.toLowerCase()}`;
        return res.redirect(`${regionPrefix}/article/${altSlug}`);
      }

      return res.status(403).json({
        success: false,
        message: 'Article not available in your region',
      });
    }
  }

  const translation = article.getTranslation(language);
  if (!translation || !translation.title) {
    const defaultTranslation = article.getTranslation(article.defaultLanguage);
    if (!defaultTranslation || !defaultTranslation.title) {
      return res.status(404).json({
        success: false,
        message: 'Translation not available',
      });
    }
    req.language = article.defaultLanguage;
  }

  req.article = article;
  next();
});

module.exports = { checkArticleAccess };
