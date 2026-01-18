const Article = require('../models/Article');
const Category = require('../models/Category');
const Author = require('../models/Author');
const { asyncHandler } = require('./errorHandler');

/**
 * Redirect legacy URLs to new multilingual structure
 * Handles:
 * - /article/:slug -> /:lang/article/:slug or /article/:slug (if default language)
 * - /category/:slug -> /:lang/category/:slug or /category/:slug
 * - /author/:slug -> /:lang/author/:slug or /author/:slug
 */
const redirectLegacyUrls = asyncHandler(async (req, res, next) => {
  // Only handle GET requests
  if (req.method !== 'GET') {
    return next();
  }

  const path = req.path;
  const defaultLanguage = 'en';

  // Handle legacy article URLs: /article/:slug
  if (path.startsWith('/article/')) {
    const slug = path.replace('/article/', '');
    
    try {
      // Try to find article by legacy slug or baseSlug
      let article = await Article.findOne({
        $or: [
          { slug: slug },
          { baseSlug: slug },
          { 'translations.en.slug': slug },
          { 'translations.fr.slug': slug },
          { 'translations.es.slug': slug },
          { 'translations.de.slug': slug },
          { 'translations.it.slug': slug },
          { 'translations.pt.slug': slug },
          { 'translations.sv.slug': slug },
          { 'translations.fi.slug': slug },
          { 'translations.da.slug': slug },
          { 'translations.no.slug': slug },
          { 'translations.nl.slug': slug }
        ],
        published: true
      });

      if (article) {
        // Get default language translation
        const defaultLang = article.defaultLanguage || defaultLanguage;
        const translation = article.translations[defaultLang];
        const articleSlug = translation?.slug || article.baseSlug || article.slug;
        
        // Build redirect URL
        let redirectUrl;
        if (defaultLang === 'en') {
          redirectUrl = `/article/${articleSlug}`;
        } else {
          redirectUrl = `/${defaultLang}/article/${articleSlug}`;
        }
        
        // Preserve query parameters
        if (req.query && Object.keys(req.query).length > 0) {
          const queryString = new URLSearchParams(req.query).toString();
          redirectUrl += `?${queryString}`;
        }
        
        return res.redirect(301, redirectUrl);
      }
    } catch (error) {
      // If error, continue to next middleware (don't break the app)
      console.error('Error in legacy URL redirect:', error);
    }
  }

  // Handle legacy category URLs: /category/:slug
  if (path.startsWith('/category/')) {
    const slug = path.replace('/category/', '');
    
    try {
      let category = await Category.findOne({
        $or: [
          { slug: slug },
          { baseSlug: slug },
          { 'translations.en.slug': slug },
          { 'translations.fr.slug': slug },
          { 'translations.es.slug': slug },
          { 'translations.de.slug': slug },
          { 'translations.it.slug': slug },
          { 'translations.pt.slug': slug },
          { 'translations.sv.slug': slug },
          { 'translations.fi.slug': slug },
          { 'translations.da.slug': slug },
          { 'translations.no.slug': slug },
          { 'translations.nl.slug': slug }
        ]
      });

      if (category) {
        const defaultLang = category.defaultLanguage || defaultLanguage;
        const translation = category.translations[defaultLang];
        const categorySlug = translation?.slug || category.baseSlug || category.slug;
        
        let redirectUrl;
        if (defaultLang === 'en') {
          redirectUrl = `/category/${categorySlug}`;
        } else {
          redirectUrl = `/${defaultLang}/category/${categorySlug}`;
        }
        
        if (req.query && Object.keys(req.query).length > 0) {
          const queryString = new URLSearchParams(req.query).toString();
          redirectUrl += `?${queryString}`;
        }
        
        return res.redirect(301, redirectUrl);
      }
    } catch (error) {
      console.error('Error in legacy category URL redirect:', error);
    }
  }

  // Handle legacy author URLs: /author/:slug
  if (path.startsWith('/author/')) {
    const slug = path.replace('/author/', '');
    
    try {
      let author = await Author.findOne({
        $or: [
          { slug: slug },
          { baseSlug: slug },
          { 'translations.en.slug': slug },
          { 'translations.fr.slug': slug },
          { 'translations.es.slug': slug },
          { 'translations.de.slug': slug },
          { 'translations.it.slug': slug },
          { 'translations.pt.slug': slug },
          { 'translations.sv.slug': slug },
          { 'translations.fi.slug': slug },
          { 'translations.da.slug': slug },
          { 'translations.no.slug': slug },
          { 'translations.nl.slug': slug }
        ]
      });

      if (author) {
        const defaultLang = author.defaultLanguage || defaultLanguage;
        const translation = author.translations[defaultLang];
        const authorSlug = translation?.slug || author.baseSlug || author.slug;
        
        let redirectUrl;
        if (defaultLang === 'en') {
          redirectUrl = `/author/${authorSlug}`;
        } else {
          redirectUrl = `/${defaultLang}/author/${authorSlug}`;
        }
        
        if (req.query && Object.keys(req.query).length > 0) {
          const queryString = new URLSearchParams(req.query).toString();
          redirectUrl += `?${queryString}`;
        }
        
        return res.redirect(301, redirectUrl);
      }
    } catch (error) {
      console.error('Error in legacy author URL redirect:', error);
    }
  }

  // If no redirect needed, continue to next middleware
  next();
});

module.exports = { redirectLegacyUrls };

