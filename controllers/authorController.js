const Author = require('../models/Author');
const Article = require('../models/Article');
const { asyncHandler } = require('../middleware/errorHandler');

const formatAuthorPublic = (author, language) => {
  if (!author) return null;
  const translation = author.getTranslation(language);
  const defaultTranslation = author.getTranslation(author.defaultLanguage);
  const activeTranslation = translation || defaultTranslation;

  return {
    _id: author._id,
    baseSlug: author.baseSlug,
    slug: activeTranslation?.slug || author.slug || author.baseSlug,
    name: author.name,
    bio: activeTranslation?.bio || author.bio,
    avatar: author.avatar,
    email: author.email,
    socialLinks: author.socialLinks || {},
    customLinks: (author.customLinks || []).filter((link) => link?.url),
    articleCount: author.articleCount,
    totalViews: author.totalViews,
    language,
  };
};

const { transformArticleForPublic } = require('../utils/publicContent');
const { isObjectIdString } = require('../utils/objectIdUtils');

const applyAuthorPayload = (author, body) => {
  const {
    name,
    bio,
    avatar,
    email,
    socialLinks,
    customLinks,
    baseSlug,
    defaultLanguage,
    translations,
    slug,
  } = body;

  if (name) author.name = name;
  if (bio !== undefined) author.bio = bio;
  if (avatar !== undefined) author.avatar = avatar;
  if (email !== undefined) author.email = email;
  if (baseSlug) author.baseSlug = baseSlug;
  if (defaultLanguage) author.defaultLanguage = defaultLanguage;
  if (slug) author.slug = slug;

  if (socialLinks) {
    author.socialLinks = { ...author.socialLinks, ...socialLinks };
  }

  if (Array.isArray(customLinks)) {
    author.customLinks = customLinks
      .filter((link) => link && link.url && String(link.url).trim())
      .map((link) => ({
        label: String(link.label || link.url).trim().slice(0, 80),
        url: String(link.url).trim(),
      }));
  }

  if (translations && typeof translations === 'object') {
    Object.entries(translations).forEach(([lang, value]) => {
      if (!value || typeof value !== 'object') return;
      author.translations[lang] = {
        ...(author.translations[lang]?.toObject?.() || author.translations[lang] || {}),
        ...value,
      };
    });
  }
};

/**
 * @desc    Get all authors (multilingual support)
 * @route   GET /api/authors
 * @access  Public
 */
exports.getAllAuthors = asyncHandler(async (req, res) => {
  const language = (req.query.lang || req.language || 'en').toLowerCase();
  const tenantFilter = req.tenantId ? { tenantId: req.tenantId } : {};
  
  const authors = await Author.find(tenantFilter)
    .sort({ articleCount: -1, name: 1 });
  
  const transformedAuthors = authors.map((author) => formatAuthorPublic(author, language));
  
  res.json({
    success: true,
    count: transformedAuthors.length,
    language,
    data: transformedAuthors
  });
});

/**
 * @desc    Get single author by ID
 * @route   GET /api/authors/admin/:id
 * @access  Private/Admin
 */
exports.getAuthorById = asyncHandler(async (req, res) => {
  const author = await Author.findOne({
    _id: req.params.id,
    ...(req.tenantId ? { tenantId: req.tenantId } : {})
  });
  
  if (!author) {
    return res.status(404).json({
      success: false,
      message: 'Author not found'
    });
  }
  
  res.json({
    success: true,
    data: author
  });
});

/**
 * @desc    Get single author by slug (multilingual support)
 * @route   GET /api/authors/:slug
 * @access  Public
 */
exports.getAuthorBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const language = (req.query.lang || req.language || 'en').toLowerCase();
  
  // Try to find by language-specific slug or base slug
  const tenantFilter = req.tenantId ? { tenantId: req.tenantId } : {};
  const slugOr = [
    { [`translations.${language}.slug`]: slug },
    { baseSlug: slug },
    { slug: slug },
  ];
  if (isObjectIdString(slug)) {
    slugOr.push({ _id: slug, ...tenantFilter });
  }

  let author = await Author.findOne({
    ...tenantFilter,
    $or: slugOr,
  });
  
  if (!author) {
    return res.status(404).json({
      success: false,
      message: 'Author not found'
    });
  }
  
  res.json({
    success: true,
    data: formatAuthorPublic(author, language),
  });
});

/**
 * @desc    Get articles by author (multilingual support)
 * @route   GET /api/authors/:slug/articles
 * @access  Public
 */
exports.getAuthorArticles = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const language = (req.query.lang || req.language || 'en').toLowerCase();
  const region = req.region || req.query.region || 'US';
  
  // Find author by slug
  const tenantFilter = req.tenantId ? { tenantId: req.tenantId } : {};
  const slugOr = [
    { [`translations.${language}.slug`]: slug },
    { baseSlug: slug },
    { slug: slug },
  ];
  if (isObjectIdString(slug)) {
    slugOr.push({ _id: slug, ...tenantFilter });
  }

  let author = await Author.findOne({
    ...tenantFilter,
    $or: slugOr,
  });
  
  if (!author) {
    return res.status(404).json({
      success: false,
      message: 'Author not found'
    });
  }
  
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  // Build query with region filtering
  const query = { 
    author: author._id, 
    published: true,
    ...(req.tenantId ? { tenantId: req.tenantId } : {})
  };
  
  // Region filtering
  if (region) {
    query.$or = [
      { isGlobal: true },
      { regionRestrictions: region }
    ];
  } else {
    query.isGlobal = true;
  }
  
  const articles = await Article.find(query)
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar baseSlug defaultLanguage translations');
  
  const transformedArticles = articles
    .map((article) => transformArticleForPublic(article, language))
    .filter(Boolean);

  const total = await Article.countDocuments(query);

  res.json({
    success: true,
    count: transformedArticles.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    language,
    region,
    author: formatAuthorPublic(author, language),
    data: transformedArticles,
  });
});

/**
 * @desc    Create new author
 * @route   POST /api/authors
 * @access  Private/Admin
 */
exports.createAuthor = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (!payload.baseSlug && payload.name) {
    const generateSlug = require('../utils/generateSlug');
    payload.baseSlug = generateSlug(payload.name);
  }

  const author = new Author({
    ...(req.tenantId ? { tenantId: req.tenantId } : {}),
    name: payload.name,
    baseSlug: payload.baseSlug,
    defaultLanguage: payload.defaultLanguage || 'en',
  });
  applyAuthorPayload(author, payload);
  await author.save();

  res.status(201).json({
    success: true,
    data: author,
  });
});

/**
 * @desc    Update author
 * @route   PUT /api/authors/:id
 * @access  Private/Admin
 */
exports.updateAuthor = asyncHandler(async (req, res) => {
  const author = await Author.findOne({
    _id: req.params.id,
    ...(req.tenantId ? { tenantId: req.tenantId } : {}),
  });

  if (!author) {
    return res.status(404).json({
      success: false,
      message: 'Author not found',
    });
  }

  applyAuthorPayload(author, req.body);
  await author.save();

  res.json({
    success: true,
    data: author,
  });
});

/**
 * @desc    Delete author
 * @route   DELETE /api/authors/:id
 * @access  Private/Admin
 */
exports.deleteAuthor = asyncHandler(async (req, res) => {
  const author = await Author.findOne({
    _id: req.params.id,
    ...(req.tenantId ? { tenantId: req.tenantId } : {})
  });
  
  if (!author) {
    return res.status(404).json({
      success: false,
      message: 'Author not found'
    });
  }
  
  // Check if author has articles
  const articleCount = await Article.countDocuments({
    author: author._id,
    ...(req.tenantId ? { tenantId: req.tenantId } : {})
  });
  if (articleCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete author with ${articleCount} article(s). Please reassign or delete articles first.`
    });
  }
  
  await author.deleteOne();
  
  res.json({
    success: true,
    message: 'Author deleted successfully'
  });
});

