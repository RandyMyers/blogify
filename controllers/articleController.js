const Article = require('../models/Article');
const Category = require('../models/Category');
const Author = require('../models/Author');
const Visitor = require('../models/Visitor');
const { asyncHandler } = require('../middleware/errorHandler');
const { scopedFilter, scopedIdFilter } = require('../utils/tenantScope');
const { getClientIP, parseUserAgent, isBot, getLocationFromIP } = require('../middleware/visitorTracking');
const logger = require('../utils/logger');
const Region = require('../models/Region');
const {
  getSlugForRegion,
  collectArticleSlugs,
  buildAvailableRegions,
  sanitizeRegionSlugsInput,
} = require('../utils/regionSlug');

const FOLLOW_BLOCKLIST = new Set(['nofollow', 'ugc', 'sponsored']);
const mongoose = require('mongoose');

const normalizeTranslationAuthorId = (value) => {
  if (!value) return null;
  const id = String(value._id || value).trim();
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return id;
};

const enforceFollowLinks = (html = '') => {
  if (typeof html !== 'string' || !html) return html;
  return html.replace(/<a\b([^>]*)>/gi, (full, attrs = '') => {
    const relMatch = attrs.match(/\srel\s*=\s*(['"])(.*?)\1/i);
    if (!relMatch) return full;
    const quote = relMatch[1];
    const relValue = relMatch[2] || '';
    const cleaned = relValue
      .split(/\s+/)
      .map((token) => token.trim().toLowerCase())
      .filter((token) => token && !FOLLOW_BLOCKLIST.has(token));
    const replacement = cleaned.length > 0 ? ` rel=${quote}${cleaned.join(' ')}${quote}` : '';
    return full.replace(relMatch[0], replacement);
  });
};

const normalizeContentParagraphs = (content) => {
  if (!Array.isArray(content)) return content;
  return content.map((paragraph) => enforceFollowLinks(paragraph));
};

const normalizeTranslationsForLinks = (translations) => {
  if (!translations || typeof translations !== 'object') return translations;
  const normalized = {};
  Object.keys(translations).forEach((lang) => {
    const translation = translations[lang];
    if (!translation || typeof translation !== 'object') {
      normalized[lang] = translation;
      return;
    }
    const offers = Array.isArray(translation.offers)
      ? translation.offers
          .map((offer) => {
            if (!offer || typeof offer !== 'object') return null;
            return {
              imageUrl: String(offer.imageUrl || '').trim(),
              title: String(offer.title || '').trim(),
              description: String(offer.description || '').trim(),
              url: String(offer.url || '').trim(),
              buttonLabel: String(offer.buttonLabel || 'View offer').trim() || 'View offer',
            };
          })
          .filter((offer) => offer && (offer.title || offer.url || offer.imageUrl))
      : [];

    normalized[lang] = {
      ...translation,
      content: normalizeContentParagraphs(translation.content),
      offers,
      author: normalizeTranslationAuthorId(translation.author),
    };
  });
  return normalized;
};

const { formatPopulatedAuthor, formatPopulatedCategory, transformArticleForPublic: transformArticlePublic, resolveArticleAuthor, collectTranslationAuthorIds } = require('../utils/publicContent');
const { notifyArticlePublished } = require('../utils/indexNow');
const { getOrCreateSeoSettings } = require('./seoSettingsController');
const { applyCanonicalUrlsToPayload } = require('../utils/canonicalUrl');
const {
  analyzeArticlePayload,
  applySeoScoreToDocument,
} = require('../utils/articleSeoHelpers');

const loadTranslationAuthorMap = async (articles) => {
  const ids = collectTranslationAuthorIds(articles);
  if (!ids.length) return {};
  const authors = await Author.find({ _id: { $in: ids } }).select(
    'name slug avatar baseSlug defaultLanguage translations'
  );
  return Object.fromEntries(authors.map((a) => [String(a._id), a]));
};

const { buildTranslationSeo } = require('../utils/translationSeo');

function serializeOffers(offers = []) {
  if (!Array.isArray(offers)) return [];
  return offers.map((offer) => ({
    _id: offer._id,
    imageUrl: offer.imageUrl || '',
    title: offer.title || '',
    description: offer.description || '',
    url: offer.url || '',
    buttonLabel: offer.buttonLabel || 'View offer',
  }));
}

const resolveRequestLanguage = (req) =>
  (req.query.lang || req.language || 'en').toLowerCase();

const transformArticleForPublic = (article, language, authorMap = {}) => {
  const base = transformArticlePublic(article, language, authorMap);
  if (!base) return null;
  const translation = article.getTranslation(language) || article.getTranslation(article.defaultLanguage);
  return {
    ...base,
    seo: buildTranslationSeo(translation),
    twitterCard: article.twitterCard || 'summary_large_image',
    articleSchema: {
      publisher: article.articleSchema?.publisher || '',
      articleSection: article.articleSchema?.articleSection || '',
    },
    availableLanguages: article.getAvailableLanguages(),
    isGlobal: article.isGlobal,
    regionRestrictions: article.regionRestrictions,
  };
};

/**
 * @desc    Get single article by ID (admin)
 * @route   GET /api/articles/admin/:id
 * @access  Private/Admin
 */
exports.getArticleById = asyncHandler(async (req, res) => {
  const filter = scopedIdFilter(req, req.params.id);
  const article = await Article.findOne(filter)
    .populate('category', 'name slug color description')
    .populate('author', 'name slug avatar bio socialLinks');

  if (!article) {
    return res.status(404).json({
      success: false,
      message: 'Article not found',
    });
  }

  res.json({
    success: true,
    data: article,
  });
});

/**
 * @desc    Get all published articles with pagination (multilingual support)
 * @route   GET /api/articles
 * @access  Public
 */
exports.getAllArticles = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  const category = req.query.category;
  const author = req.query.author;
  const featured = req.query.featured === 'true';
  const trending = req.query.trending === 'true';
  
  // Get language and region from request (set by detectRegion middleware)
  const language = resolveRequestLanguage(req);
  const region = req.query.region || req.region || 'US';
  
  // Build query
  const query = { published: true, ...scopedFilter(req) };
  
  // Region filtering
  if (region) {
    query.$or = [
      { isGlobal: true },
      { regionRestrictions: region }
    ];
  } else {
    // If no region specified, only show global articles
    query.isGlobal = true;
  }
  
  // Category filter
  if (category) {
    query.category = category;
  }
  
  // Author filter
  if (author) {
    query.author = author;
  }
  
  // Featured filter
  if (featured === true) {
    query.featured = true;
  }
  
  // Trending filter
  if (trending === true) {
    query.trending = true;
  }
  
  const articles = await Article.find(query)
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar baseSlug defaultLanguage translations');
  
  const authorMap = await loadTranslationAuthorMap(articles);
  const transformedArticles = articles
    .map((article) => transformArticleForPublic(article, language, authorMap))
    .filter((article) => article !== null);
  
  const total = await Article.countDocuments(query);
  
  res.json({
    success: true,
    count: transformedArticles.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    language,
    region,
    data: transformedArticles
  });
});

/**
 * @desc    Get all articles for admin (includes drafts and published)
 * @route   GET /api/articles/admin/list
 * @access  Private/Admin
 */
exports.getAllArticlesAdmin = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const category = req.query.category;
  const author = req.query.author;
  const publishedParam = req.query.published; // 'true' | 'false' | undefined (all)
  const search = String(req.query.search || '').trim();
  const seoFilter = req.query.seoFilter;
  const language = resolveRequestLanguage(req);

  const query = { ...scopedFilter(req) };
  if (publishedParam === 'true') query.published = true;
  if (publishedParam === 'false') query.published = false;
  if (category) query.category = category;
  if (author) query.author = author;

  if (seoFilter === 'needs_improvement') {
    query.$or = [
      { seoScore: { $lt: 60 } },
      { seoScore: null },
      { seoScore: { $exists: false } },
    ];
  } else if (seoFilter === 'good') {
    query.seoScore = { $gte: 60 };
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const searchOr = [
      { baseSlug: regex },
      { 'translations.en.title': regex },
      { 'translations.en.slug': regex },
      { 'translations.fr.title': regex },
      { 'translations.es.title': regex },
      { 'translations.de.title': regex },
      { 'translations.it.title': regex },
      { 'translations.pt.title': regex },
      { 'translations.da.title': regex },
      { 'translations.no.title': regex },
      { 'translations.sv.title': regex },
      { 'translations.fi.title': regex },
      { 'translations.nl.title': regex },
    ];
    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: searchOr }];
      delete query.$or;
    } else {
      query.$or = searchOr;
    }
  }

  const articles = await Article.find(query)
    .sort({ updatedAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar baseSlug defaultLanguage translations');

  const transformedArticles = articles.map(article => {
    const translation = article.getTranslation(language);
    const defaultTranslation = article.getTranslation(article.defaultLanguage);
    const activeTranslation = translation || defaultTranslation;

    if (!activeTranslation) {
      return null;
    }

    let categoryData = article.category;
    if (article.category && article.category.getTranslation) {
      const categoryTranslation = article.category.getTranslation(language);
      if (categoryTranslation) {
        categoryData = {
          ...article.category.toObject(),
          name: categoryTranslation.name || article.category.name,
          slug: categoryTranslation.slug || article.category.slug,
          description: categoryTranslation.description || article.category.description
        };
      }
    }

    let authorData = article.author;
    if (article.author && article.author.getTranslation) {
      const authorTranslation = article.author.getTranslation(language);
      if (authorTranslation) {
        authorData = {
          ...article.author.toObject(),
          bio: authorTranslation.bio || article.author.bio
        };
      }
    }

    return {
      _id: article._id,
      baseSlug: article.baseSlug,
      slug: activeTranslation.slug,
      title: activeTranslation.title,
      excerpt: activeTranslation.excerpt,
      content: activeTranslation.content,
      imageUrl: article.imageUrl,
    imageAlt: article.imageAlt || '',
      category: categoryData,
      author: authorData,
      tags: article.tags,
      published: article.published,
      publishedAt: article.publishedAt,
      views: article.views,
      likes: article.likes,
      readTime: article.readTime,
      featured: article.featured,
      trending: article.trending,
      translations: article.translations,
      defaultLanguage: article.defaultLanguage,
      isGlobal: article.isGlobal,
      regionRestrictions: article.regionRestrictions,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      seoScore: article.seoScore,
      seoScoreUpdatedAt: article.seoScoreUpdatedAt,
      seo: buildTranslationSeo(activeTranslation),
      language,
      availableLanguages: article.getAvailableLanguages()
    };
  }).filter(article => article !== null);

  const total = await Article.countDocuments(query);

  res.json({
    success: true,
    count: transformedArticles.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: transformedArticles
  });
});

/**
 * @desc    Get single article by slug (multilingual support)
 * @route   GET /api/articles/:slug
 * @access  Public
 */
exports.getArticleBySlug = asyncHandler(async (req, res) => {
  // Article should already be attached by checkArticleAccess middleware
  const article = req.article;
  const language = resolveRequestLanguage(req);
  const region = req.query.region || req.region || 'US';
  
  // Get translation for current language
  const translation = article.getTranslation(language);
  const defaultTranslation = article.getTranslation(article.defaultLanguage);
  const activeTranslation = translation || defaultTranslation;
  
  if (!activeTranslation || !activeTranslation.title) {
    return res.status(404).json({
      success: false,
      message: 'Translation not available'
    });
  }

  const regions = await Region.find({ isActive: true }).select('code defaultLanguage isActive').lean();
  const regionSlug = getSlugForRegion(article, region);
  const seoSettings = await getOrCreateSeoSettings(req.tenantId);
  const siteUrl = seoSettings.siteUrl || process.env.CLIENT_URL || 'https://bloomwik.com';
  
  // Increment views
  await article.incrementViews();
  
  // Get formatted author & category (populated in checkArticleAccess)
  const authorMap = await loadTranslationAuthorMap(article);
  const authorData = resolveArticleAuthor(article, language, authorMap);
  const categoryData = formatPopulatedCategory(article.category, language);
  
  // Build available translations object
  const availableTranslations = {};
  const availableLanguages = article.getAvailableLanguages();
  availableLanguages.forEach(lang => {
    const langTranslation = article.getTranslation(lang);
    if (langTranslation) {
      availableTranslations[lang] = {
        slug: langTranslation.slug,
        title: langTranslation.title
      };
    }
  });
  
  res.json({
    success: true,
    data: {
      _id: article._id,
      baseSlug: article.baseSlug,
      slug: regionSlug,
      title: activeTranslation.title,
      excerpt: activeTranslation.excerpt,
      content: activeTranslation.content,
      imageUrl: article.imageUrl,
    imageAlt: article.imageAlt || '',
      category: categoryData,
      author: authorData,
      tags: article.tags,
      publishedAt: article.publishedAt,
      views: article.views,
      likes: article.likes,
      readTime: article.readTime,
      featured: article.featured,
      trending: article.trending,
      seo: buildTranslationSeo(activeTranslation, {
        siteUrl,
        regionCode: region,
        slug: regionSlug,
      }),
      language: language,
      offers: serializeOffers(activeTranslation.offers),
      availableTranslations: availableTranslations,
      availableRegions: buildAvailableRegions(article, regions, seoSettings.hreflang?.includeRegionalVariants !== false),
      isGlobal: article.isGlobal,
      regionRestrictions: article.regionRestrictions
    }
  });
});

/**
 * @desc    Track article view
 * @route   POST /api/articles/:slug/view
 * @access  Public
 */
exports.trackView = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const language = resolveRequestLanguage(req);
  
  // Find article by slug (check all language slugs and base slug)
  const article = await Article.findOne({
    ...scopedFilter(req),
    $or: [
      { baseSlug: slug },
      { [`translations.${language}.slug`]: slug },
      { slug: slug }, // legacy support
      { previousSlugs: slug } // renamed slug support
    ]
  });

  if (!article) {
    return res.status(404).json({
      success: false,
      message: 'Article not found'
    });
  }

  // Only track views for published articles
  if (!article.published) {
    return res.status(404).json({
      success: false,
      message: 'Article not found'
    });
  }

  // Increment view count using model method
  await article.incrementViews();

  // Track visitor information (async, don't block response)
  setImmediate(async () => {
    try {
      const ip = getClientIP(req);
      const userAgent = req.headers['user-agent'] || '';
      
      // Skip bots if configured
      if (isBot(userAgent) && process.env.TRACK_BOTS !== 'true') {
        return;
      }
      
      const { device, browser, os } = parseUserAgent(userAgent);
      const referrer = req.headers['referer'] || req.headers['referrer'] || null;
      const location = await getLocationFromIP(ip);
      const userId = req.user ? req.user._id : null;
      const sessionId = req.cookies?.sessionId || null;
      const language = resolveRequestLanguage(req);
      
      await Visitor.create({
        tenantId: req.tenantId,
        ipAddress: ip,
        country: location.country,
        region: location.region,
        city: location.city,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone,
        userAgent,
        referrer,
        path: req.path,
        query: req.query && Object.keys(req.query).length > 0 
          ? JSON.stringify(req.query) 
          : null,
        articleId: article._id,
        articleSlug: slug,
        sessionId,
        device,
        browser,
        os,
        userId,
        isBot: isBot(userAgent),
        language
      });
    } catch (error) {
      // Log error but don't break the response
      logger.error('Error tracking visitor for article view', {
        error: error.message,
        articleId: article._id,
        requestId: req.requestId
      });
    }
  });

  res.json({
    success: true,
    views: article.views
  });
});

/**
 * @desc    Get top articles
 * @route   GET /api/articles/top
 * @access  Public
 */
exports.getTopArticles = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const language = resolveRequestLanguage(req);
  const articles = await Article.find({ ...scopedFilter(req), published: true })
    .sort({ views: -1, publishedAt: -1 })
    .limit(limit)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar baseSlug defaultLanguage translations');

  const authorMap = await loadTranslationAuthorMap(articles);
  const data = articles
    .map((article) => transformArticleForPublic(article, language, authorMap))
    .filter(Boolean);

  res.json({
    success: true,
    count: data.length,
    language,
    data,
  });
});

/**
 * @desc    Get popular articles
 * @route   GET /api/articles/popular
 * @access  Public
 */
exports.getPopularArticles = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const language = resolveRequestLanguage(req);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const articles = await Article.find({
    ...scopedFilter(req),
    published: true,
    publishedAt: { $gte: thirtyDaysAgo },
    views: { $gt: 0 },
  })
    .sort({ views: -1, likes: -1, publishedAt: -1 })
    .limit(limit)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar baseSlug defaultLanguage translations');

  const authorMap = await loadTranslationAuthorMap(articles);
  const data = articles
    .map((article) => transformArticleForPublic(article, language, authorMap))
    .filter(Boolean);

  res.json({
    success: true,
    count: data.length,
    language,
    data,
  });
});

/**
 * @desc    Get trending articles
 * @route   GET /api/articles/trending
 * @access  Public
 */
exports.getTrendingArticles = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const language = resolveRequestLanguage(req);
  const articles = await Article.find({
    ...scopedFilter(req),
    trending: true,
    published: true,
  })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar baseSlug defaultLanguage translations');

  const authorMap = await loadTranslationAuthorMap(articles);
  const data = articles
    .map((article) => transformArticleForPublic(article, language, authorMap))
    .filter(Boolean);

  res.json({
    success: true,
    count: data.length,
    language,
    data,
  });
});

/**
 * @desc    Get featured article
 * @route   GET /api/articles/featured
 * @access  Public
 */
exports.getFeaturedArticle = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 1;
  const language = resolveRequestLanguage(req);
  const articles = await Article.find({
    ...scopedFilter(req),
    featured: true,
    published: true,
  })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar baseSlug defaultLanguage translations');

  const authorMap = await loadTranslationAuthorMap(articles);
  const data = articles
    .map((article) => transformArticleForPublic(article, language, authorMap))
    .filter(Boolean);

  res.json({
    success: true,
    count: data.length,
    language,
    data,
  });
});

/**
 * @desc    Create new article
 * @route   POST /api/articles
 * @access  Private/Admin
 */
exports.createArticle = asyncHandler(async (req, res) => {
  const {
    // Multilingual fields
    baseSlug,
    defaultLanguage,
    isGlobal,
    regionRestrictions,
    regionSlugs,
    translations,
    // Legacy fields (for backward compatibility)
    title,
    excerpt,
    content,
    // Shared fields
    imageUrl,
    imageAlt,
    category,
    author,
    tags,
    published,
    featured,
    trending,
    seo,
    twitterCard,
    articleSchema,
  } = req.body;
  
  // Validate category exists
  const categoryDoc = await Category.findOne({ _id: category });
  if (!categoryDoc) {
    return res.status(400).json({
      success: false,
      message: 'Category not found'
    });
  }
  
  // Validate author exists
  const authorDoc = await Author.findOne({ _id: author });
  if (!authorDoc) {
    return res.status(400).json({
      success: false,
      message: 'Author not found'
    });
  }
  
  const normalizedTranslations = normalizeTranslationsForLinks(translations || {});
  // Default locale uses the primary article author; other locales may override.
  const defLang = defaultLanguage || 'en';
  if (normalizedTranslations[defLang]) {
    normalizedTranslations[defLang].author = author;
  }

  const localeAuthorIds = [
    ...new Set(
      Object.values(normalizedTranslations)
        .map((tr) => normalizeTranslationAuthorId(tr?.author))
        .filter(Boolean)
    ),
  ];
  if (localeAuthorIds.length) {
    const localeAuthorCount = await Author.countDocuments({ _id: { $in: localeAuthorIds } });
    if (localeAuthorCount !== localeAuthorIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more locale authors were not found',
      });
    }
  }

  const normalizedLegacyContent = normalizeContentParagraphs(content || normalizedTranslations?.[defLang]?.content || []);

  const seoSettings = await getOrCreateSeoSettings(req.tenantId);
  const canonicalPayload = applyCanonicalUrlsToPayload(
    {
      defaultLanguage: defLang,
      baseSlug: baseSlug || translations?.[defLang]?.slug,
      slug: baseSlug || translations?.[defLang]?.slug,
      translations: normalizedTranslations,
    },
    seoSettings.siteUrl
  );

  // Build article data with multilingual support
  const articleData = {
    ...scopedFilter(req),
    // Multilingual fields
    baseSlug: canonicalPayload.baseSlug || baseSlug || (translations?.[defLang]?.slug),
    defaultLanguage: defLang,
    isGlobal: isGlobal !== undefined ? isGlobal : true,
    regionRestrictions: isGlobal ? [] : (regionRestrictions || []),
    regionSlugs: sanitizeRegionSlugsInput(regionSlugs || {}),
    translations: canonicalPayload.translations || normalizedTranslations,
    // Legacy fields (for backward compatibility)
    title: title || translations?.[defLang]?.title || '',
    excerpt: excerpt || translations?.[defLang]?.excerpt || '',
    content: normalizedLegacyContent,
    // Shared fields
    imageUrl,
    imageAlt: imageAlt || '',
    category,
    author,
    tags: tags || [],
    published: published || false,
    featured: featured || false,
    trending: trending || false,
    seo: seo || {},
    twitterCard: twitterCard || 'summary_large_image',
    articleSchema: articleSchema || {},
  };
  
  const article = await Article.create(articleData);

  applySeoScoreToDocument(article, seoSettings.siteUrl);
  await article.save();
  
  // Update category post count
  await categoryDoc.updatePostCount();
  
  // Update author article count
  await authorDoc.updateArticleCount();
  
  const populatedArticle = await Article.findById(article._id)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar baseSlug defaultLanguage translations');

  if (article.published) {
    setImmediate(() => {
      notifyArticlePublished(article, { tenantId: req.tenantId }).catch((err) => {
        logger.warn('IndexNow notify failed (create):', err.message);
      });
    });
  }

  res.status(201).json({
    success: true,
    data: populatedArticle
  });
});

/**
 * @desc    Update article
 * @route   PUT /api/articles/:id
 * @access  Private/Admin
 */
const ARTICLE_SLUG_LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];

exports.updateArticle = asyncHandler(async (req, res) => {
  const filter = scopedIdFilter(req, req.params.id);
  const article = await Article.findOne(filter);
  
  if (!article) {
    return res.status(404).json({
      success: false,
      message: 'Article not found'
    });
  }

  // Snapshot current slugs before applying updates so renamed slugs can keep
  // redirecting (301) to the new canonical URL.
  const previousSlugSnapshot = collectArticleSlugs(article);
  
  // Update fields
  const {
    // Multilingual fields
    baseSlug,
    defaultLanguage,
    isGlobal,
    regionRestrictions,
    regionSlugs,
    translations,
    // Legacy fields
    title,
    excerpt,
    content,
    // Shared fields
    imageUrl,
    imageAlt,
    category,
    author,
    tags,
    published,
    featured,
    trending,
    seo,
    twitterCard,
    articleSchema,
  } = req.body;
  
  const seoSettings = await getOrCreateSeoSettings(req.tenantId);

  // Update multilingual fields
  if (baseSlug !== undefined) article.baseSlug = baseSlug;
  if (defaultLanguage !== undefined) article.defaultLanguage = defaultLanguage;
  if (isGlobal !== undefined) {
    article.isGlobal = isGlobal;
    // Clear region restrictions if global
    if (isGlobal) {
      article.regionRestrictions = [];
    }
  }
  if (regionRestrictions !== undefined && !isGlobal) {
    article.regionRestrictions = regionRestrictions;
  }
  if (regionSlugs !== undefined) {
    article.regionSlugs = sanitizeRegionSlugsInput(regionSlugs);
    article.markModified('regionSlugs');
  }
  if (translations !== undefined) {
    const normalizedTranslations = normalizeTranslationsForLinks(translations);
    const effectiveAuthor = author !== undefined ? author : article.author;
    const defLang = (defaultLanguage !== undefined ? defaultLanguage : article.defaultLanguage) || 'en';
    if (normalizedTranslations[defLang] && effectiveAuthor) {
      normalizedTranslations[defLang].author = String(effectiveAuthor._id || effectiveAuthor);
    }

    const localeAuthorIds = [
      ...new Set(
        Object.values(normalizedTranslations)
          .map((tr) => normalizeTranslationAuthorId(tr?.author))
          .filter(Boolean)
      ),
    ];
    if (localeAuthorIds.length) {
      const localeAuthorCount = await Author.countDocuments({ _id: { $in: localeAuthorIds } });
      if (localeAuthorCount !== localeAuthorIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more locale authors were not found',
        });
      }
    }

    // Merge translations; spread of Mongoose subdocs can omit or mishandle nested arrays.
    // Convert existing subdocs with toObject(), then markModified so content[] persists.
    Object.keys(normalizedTranslations).forEach((lang) => {
      const incoming = normalizedTranslations[lang];
      if (!incoming) return;
      const existing = article.translations[lang];
      if (existing) {
        const existingPlain =
          typeof existing.toObject === 'function'
            ? existing.toObject()
            : { ...existing };
        article.translations[lang] = { ...existingPlain, ...incoming };
      } else {
        article.translations[lang] = incoming;
      }
    });
    article.markModified('translations');

    const canonicalPayload = applyCanonicalUrlsToPayload(
      {
        defaultLanguage: article.defaultLanguage,
        baseSlug: article.baseSlug,
        slug: article.baseSlug,
        translations: Object.fromEntries(
          Object.keys(article.translations || {}).map((lang) => {
            const t = article.translations[lang];
            const plain = typeof t?.toObject === 'function' ? t.toObject() : t;
            return [lang, plain];
          })
        ),
      },
      seoSettings.siteUrl
    );
    Object.entries(canonicalPayload.translations || {}).forEach(([lang, t]) => {
      if (article.translations[lang] && t?.canonicalUrl) {
        article.translations[lang].canonicalUrl = t.canonicalUrl;
      }
    });
    article.markModified('translations');
  }
  
  // Update legacy fields (for backward compatibility)
  if (title) article.title = title;
  if (excerpt) article.excerpt = excerpt;
  if (content) article.content = normalizeContentParagraphs(content);
  if (imageUrl) article.imageUrl = imageUrl;
  if (imageAlt !== undefined) article.imageAlt = imageAlt || '';
  if (category) {
    const categoryDoc = await Category.findOne({ _id: category });
    if (!categoryDoc) {
      return res.status(400).json({
        success: false,
        message: 'Category not found'
      });
    }
    article.category = category;
  }
  if (author) {
    const authorDoc = await Author.findOne({ _id: author });
    if (!authorDoc) {
      return res.status(400).json({
        success: false,
        message: 'Author not found'
      });
    }
    article.author = author;
    const defLang = article.defaultLanguage || 'en';
    if (!article.translations[defLang]) {
      article.translations[defLang] = {};
    }
    article.translations[defLang].author = author;
    article.markModified('translations');
  }
  if (tags) article.tags = tags;
  if (typeof published === 'boolean') article.published = published;
  if (typeof featured === 'boolean') article.featured = featured;
  if (typeof trending === 'boolean') article.trending = trending;
  if (seo) article.seo = { ...article.seo, ...seo };
  if (twitterCard !== undefined) article.twitterCard = twitterCard;
  if (articleSchema !== undefined) {
    article.articleSchema = { ...(article.articleSchema || {}), ...articleSchema };
    article.markModified('articleSchema');
  }

  // Preserve any slugs that were just changed so old URLs keep working / 301-redirect.
  const currentSlugs = collectArticleSlugs(article);
  const retiredSlugs = [...previousSlugSnapshot].filter((s) => s && !currentSlugs.has(s));
  const existingPrevious = Array.isArray(article.previousSlugs) ? article.previousSlugs : [];
  if (retiredSlugs.length > 0 || existingPrevious.length > 0) {
    // Drop any historical slug that is live again to avoid self-redirect loops.
    const merged = new Set([...existingPrevious, ...retiredSlugs].filter((s) => s && !currentSlugs.has(s)));
    article.previousSlugs = [...merged];
    article.markModified('previousSlugs');
  }

  applySeoScoreToDocument(article, seoSettings.siteUrl);
  
  await article.save();
  
  // Update counts if category or author changed
  if (category) {
    const categoryDoc = await Category.findOne({ _id: category });
    await categoryDoc.updatePostCount();
  }
  if (author) {
    const authorDoc = await Author.findOne({ _id: author });
    await authorDoc.updateArticleCount();
  }
  
  const populatedArticle = await Article.findById(article._id)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar baseSlug defaultLanguage translations');

  if (article.published) {
    setImmediate(() => {
      notifyArticlePublished(article, { tenantId: req.tenantId }).catch((err) => {
        logger.warn('IndexNow notify failed (update):', err.message);
      });
    });
  }

  res.json({
    success: true,
    data: populatedArticle
  });
});

/**
 * @desc    Analyze article SEO (admin preview, same rules as editor)
 * @route   POST /api/articles/admin/analyze-seo
 * @access  Private/Admin
 */
exports.analyzeArticleSeo = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSeoSettings(req.tenantId);
  const analysis = analyzeArticlePayload(req.body, settings.siteUrl);
  res.json({
    success: true,
    data: analysis,
  });
});

/**
 * @desc    Delete article
 * @route   DELETE /api/articles/:id
 * @access  Private/Admin
 */
exports.deleteArticle = asyncHandler(async (req, res) => {
  const filter = scopedIdFilter(req, req.params.id);
  const article = await Article.findOne(filter);
  
  if (!article) {
    return res.status(404).json({
      success: false,
      message: 'Article not found'
    });
  }
  
  const categoryId = article.category;
  const authorId = article.author;
  
  await article.deleteOne();
  
  // Update counts
  const categoryDoc = await Category.findOne({ _id: categoryId });
  if (categoryDoc) await categoryDoc.updatePostCount();
  
  const authorDoc = await Author.findOne({ _id: authorId });
  if (authorDoc) await authorDoc.updateArticleCount();
  
  res.json({
    success: true,
    message: 'Article deleted successfully'
  });
});

