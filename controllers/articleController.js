const Article = require('../models/Article');
const Category = require('../models/Category');
const Author = require('../models/Author');
const Visitor = require('../models/Visitor');
const { asyncHandler } = require('../middleware/errorHandler');
const { getClientIP, parseUserAgent, isBot, getLocationFromIP } = require('../middleware/visitorTracking');
const logger = require('../utils/logger');

/**
 * @desc    Get single article by ID (admin)
 * @route   GET /api/articles/admin/:id
 * @access  Private/Admin
 */
exports.getArticleById = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id)
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
  const language = req.language || req.query.lang || 'en';
  const region = req.region || req.query.region || 'US';
  
  // Build query
  const query = { published: true };
  
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
    .populate('author', 'name slug avatar');
  
  // Transform articles to include language-specific content
  const transformedArticles = articles.map(article => {
    const translation = article.getTranslation(language);
    const defaultTranslation = article.getTranslation(article.defaultLanguage);
    const activeTranslation = translation || defaultTranslation;
    
    if (!activeTranslation) {
      return null;
    }
    
    // Get category translation if available
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
    
    // Get author translation if available
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
      category: categoryData,
      author: authorData,
      tags: article.tags,
      publishedAt: article.publishedAt,
      views: article.views,
      likes: article.likes,
      readTime: article.readTime,
      featured: article.featured,
      trending: article.trending,
      seo: {
        metaTitle: activeTranslation.metaTitle,
        metaDescription: activeTranslation.metaDescription,
        keywords: activeTranslation.keywords
      },
      language: language,
      availableLanguages: article.getAvailableLanguages(),
      isGlobal: article.isGlobal,
      regionRestrictions: article.regionRestrictions
    };
  }).filter(article => article !== null);
  
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
 * @desc    Get single article by slug (multilingual support)
 * @route   GET /api/articles/:slug
 * @access  Public
 */
exports.getArticleBySlug = asyncHandler(async (req, res) => {
  // Article should already be attached by checkArticleAccess middleware
  const article = req.article;
  const language = req.language || 'en';
  
  if (!article) {
    return res.status(404).json({
      success: false,
      message: 'Article not found'
    });
  }
  
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
  
  // Increment views
  await article.incrementViews();
  
  // Get category translation if available
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
  
  // Get author translation if available
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
      slug: activeTranslation.slug,
      title: activeTranslation.title,
      excerpt: activeTranslation.excerpt,
      content: activeTranslation.content,
      imageUrl: article.imageUrl,
      category: categoryData,
      author: authorData,
      tags: article.tags,
      publishedAt: article.publishedAt,
      views: article.views,
      likes: article.likes,
      readTime: article.readTime,
      featured: article.featured,
      trending: article.trending,
      seo: {
        metaTitle: activeTranslation.metaTitle,
        metaDescription: activeTranslation.metaDescription,
        keywords: activeTranslation.keywords
      },
      language: language,
      availableTranslations: availableTranslations,
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
  const language = req.language || req.query.lang || 'en';
  
  // Find article by slug (check all language slugs and base slug)
  const article = await Article.findOne({
    $or: [
      { baseSlug: slug },
      { [`translations.${language}.slug`]: slug },
      { slug: slug } // legacy support
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
      const language = req.language || req.query.lang || 
                      req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 
                      'en';
      
      await Visitor.create({
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
  const articles = await Article.getTop(limit);
  
  res.json({
    success: true,
    count: articles.length,
    data: articles
  });
});

/**
 * @desc    Get popular articles
 * @route   GET /api/articles/popular
 * @access  Public
 */
exports.getPopularArticles = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const articles = await Article.getPopular(limit);
  
  res.json({
    success: true,
    count: articles.length,
    data: articles
  });
});

/**
 * @desc    Get trending articles
 * @route   GET /api/articles/trending
 * @access  Public
 */
exports.getTrendingArticles = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const articles = await Article.getTrending(limit);
  
  res.json({
    success: true,
    count: articles.length,
    data: articles
  });
});

/**
 * @desc    Get featured article
 * @route   GET /api/articles/featured
 * @access  Public
 */
exports.getFeaturedArticle = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 1;
  const articles = await Article.getFeatured(limit);
  
  res.json({
    success: true,
    count: articles.length,
    data: articles
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
    translations,
    // Legacy fields (for backward compatibility)
    title,
    excerpt,
    content,
    // Shared fields
    imageUrl,
    category,
    author,
    tags,
    published,
    featured,
    trending,
    seo
  } = req.body;
  
  // Validate category exists
  const categoryDoc = await Category.findById(category);
  if (!categoryDoc) {
    return res.status(400).json({
      success: false,
      message: 'Category not found'
    });
  }
  
  // Validate author exists
  const authorDoc = await Author.findById(author);
  if (!authorDoc) {
    return res.status(400).json({
      success: false,
      message: 'Author not found'
    });
  }
  
  // Build article data with multilingual support
  const articleData = {
    // Multilingual fields
    baseSlug: baseSlug || (translations?.[defaultLanguage || 'en']?.slug),
    defaultLanguage: defaultLanguage || 'en',
    isGlobal: isGlobal !== undefined ? isGlobal : true,
    regionRestrictions: isGlobal ? [] : (regionRestrictions || []),
    translations: translations || {},
    // Legacy fields (for backward compatibility)
    title: title || translations?.[defaultLanguage || 'en']?.title || '',
    excerpt: excerpt || translations?.[defaultLanguage || 'en']?.excerpt || '',
    content: content || translations?.[defaultLanguage || 'en']?.content || [],
    // Shared fields
    imageUrl,
    category,
    author,
    tags: tags || [],
    published: published || false,
    featured: featured || false,
    trending: trending || false,
    seo: seo || {}
  };
  
  const article = await Article.create(articleData);
  
  // Update category post count
  await categoryDoc.updatePostCount();
  
  // Update author article count
  await authorDoc.updateArticleCount();
  
  const populatedArticle = await Article.findById(article._id)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar');
  
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
exports.updateArticle = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id);
  
  if (!article) {
    return res.status(404).json({
      success: false,
      message: 'Article not found'
    });
  }
  
  // Update fields
  const {
    // Multilingual fields
    baseSlug,
    defaultLanguage,
    isGlobal,
    regionRestrictions,
    translations,
    // Legacy fields
    title,
    excerpt,
    content,
    // Shared fields
    imageUrl,
    category,
    author,
    tags,
    published,
    featured,
    trending,
    seo
  } = req.body;
  
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
  if (translations !== undefined) {
    // Merge translations (don't overwrite, merge)
    Object.keys(translations).forEach(lang => {
      if (article.translations[lang]) {
        article.translations[lang] = { ...article.translations[lang], ...translations[lang] };
      } else {
        article.translations[lang] = translations[lang];
      }
    });
  }
  
  // Update legacy fields (for backward compatibility)
  if (title) article.title = title;
  if (excerpt) article.excerpt = excerpt;
  if (content) article.content = content;
  if (imageUrl) article.imageUrl = imageUrl;
  if (category) {
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      return res.status(400).json({
        success: false,
        message: 'Category not found'
      });
    }
    article.category = category;
  }
  if (author) {
    const authorDoc = await Author.findById(author);
    if (!authorDoc) {
      return res.status(400).json({
        success: false,
        message: 'Author not found'
      });
    }
    article.author = author;
  }
  if (tags) article.tags = tags;
  if (typeof published === 'boolean') article.published = published;
  if (typeof featured === 'boolean') article.featured = featured;
  if (typeof trending === 'boolean') article.trending = trending;
  if (seo) article.seo = { ...article.seo, ...seo };
  
  await article.save();
  
  // Update counts if category or author changed
  if (category) {
    const categoryDoc = await Category.findById(category);
    await categoryDoc.updatePostCount();
  }
  if (author) {
    const authorDoc = await Author.findById(author);
    await authorDoc.updateArticleCount();
  }
  
  const populatedArticle = await Article.findById(article._id)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar');
  
  res.json({
    success: true,
    data: populatedArticle
  });
});

/**
 * @desc    Delete article
 * @route   DELETE /api/articles/:id
 * @access  Private/Admin
 */
exports.deleteArticle = asyncHandler(async (req, res) => {
  const article = await Article.findById(req.params.id);
  
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
  const categoryDoc = await Category.findById(categoryId);
  if (categoryDoc) await categoryDoc.updatePostCount();
  
  const authorDoc = await Author.findById(authorId);
  if (authorDoc) await authorDoc.updateArticleCount();
  
  res.json({
    success: true,
    message: 'Article deleted successfully'
  });
});

