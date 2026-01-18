const Article = require('../models/Article');
const { asyncHandler } = require('./errorHandler');

/**
 * Middleware to check if article is accessible in current region
 * Also handles translation fallback
 */
const checkArticleAccess = asyncHandler(async (req, res, next) => {
  const { slug } = req.params;
  const { language, region } = req;
  
  if (!language || !region) {
    return res.status(400).json({
      success: false,
      message: 'Region and language must be detected first'
    });
  }
  
  // Try to find article by language-specific slug
  let article = await Article.findOne({
    $or: [
      { [`translations.${language}.slug`]: slug },
      { baseSlug: slug },
      // Legacy slug support
      { slug: slug }
    ]
  });
  
  // If not found, try to find by any translation slug
  if (!article) {
    const supportedLanguages = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];
    for (const lang of supportedLanguages) {
      article = await Article.findOne({
        [`translations.${lang}.slug`]: slug
      });
      if (article) break;
    }
  }
  
  if (!article) {
    return res.status(404).json({ 
      success: false, 
      message: 'Article not found' 
    });
  }
  
  // Check region access
  if (!article.isGlobal) {
    // Article is region-restricted
    if (!article.regionRestrictions || article.regionRestrictions.length === 0) {
      // No regions specified means not accessible anywhere (shouldn't happen)
      return res.status(403).json({ 
        success: false, 
        message: 'Article not available in your region' 
      });
    }
    
    if (!article.regionRestrictions.includes(region)) {
      // Try to find alternative article (global version or version for this region)
      const alternative = await Article.findOne({
        baseSlug: article.baseSlug,
        $or: [
          { isGlobal: true },
          { regionRestrictions: region }
        ],
        published: true
      });
      
      if (alternative) {
        // Redirect to alternative article with region code
        const altTranslation = alternative.getTranslation(language);
        const altSlug = altTranslation?.slug || alternative.baseSlug;
        const regionPrefix = region === 'US' ? '' : `/${region.toLowerCase()}`;
        return res.redirect(`${regionPrefix}/article/${altSlug}`);
      }
      
      return res.status(403).json({ 
        success: false, 
        message: 'Article not available in your region' 
      });
    }
  }
  
  // Check if translation exists for requested language
  const translation = article.getTranslation(language);
  if (!translation || !translation.title) {
    // Fallback to default language
    const defaultTranslation = article.getTranslation(article.defaultLanguage);
    if (!defaultTranslation || !defaultTranslation.title) {
      return res.status(404).json({ 
        success: false, 
        message: 'Translation not available' 
      });
    }
    // Update language to default for response
    req.language = article.defaultLanguage;
  }
  
  // Attach article to request
  req.article = article;
  next();
});

module.exports = { checkArticleAccess };



