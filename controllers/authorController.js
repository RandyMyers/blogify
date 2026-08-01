const Author = require('../models/Author');
const Article = require('../models/Article');
const Category = require('../models/Category');
const { scopedFilter } = require('../utils/tenantScope');
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
    createdAt: author.createdAt,
    language,
    seo: {
      metaTitle: author.metaTitle || '',
      metaDescription: author.metaDescription || '',
    },
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
    metaTitle,
    metaDescription,
  } = body;

  if (name) author.name = name;
  if (bio !== undefined) author.bio = bio;
  if (metaTitle !== undefined) author.metaTitle = metaTitle;
  if (metaDescription !== undefined) author.metaDescription = metaDescription;
  if (avatar !== undefined) author.avatar = avatar;
  if (email !== undefined) author.email = email;
  if (baseSlug) author.baseSlug = baseSlug;
  if (defaultLanguage) author.defaultLanguage = defaultLanguage;
  if (slug) author.slug = slug;

  // Replace (do not merge) so cleared fields stay cleared after save/refresh.
  if (socialLinks !== undefined && socialLinks !== null) {
    author.socialLinks = {
      twitter: socialLinks.twitter ? String(socialLinks.twitter).trim() : null,
      linkedin: socialLinks.linkedin ? String(socialLinks.linkedin).trim() : null,
      github: socialLinks.github ? String(socialLinks.github).trim() : null,
      website: socialLinks.website ? String(socialLinks.website).trim() : null,
    };
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
  const authors = await Author.find({})
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
  const author = await Author.findOne({ _id: req.params.id });
  
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
  const slugOr = [
    { [`translations.${language}.slug`]: slug },
    { baseSlug: slug },
    { slug: slug },
  ];
  if (isObjectIdString(slug)) {
    slugOr.push({ _id: slug });
  }

  let author = await Author.findOne({
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
  const sortMode = String(req.query.sort || 'newest').toLowerCase();
  const categorySlug = String(req.query.category || '').trim().toLowerCase();
  
  // Find author by slug
  const slugOr = [
    { [`translations.${language}.slug`]: slug },
    { baseSlug: slug },
    { slug: slug },
  ];
  if (isObjectIdString(slug)) {
    slugOr.push({ _id: slug });
  }

  let author = await Author.findOne({
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

  const AUTHOR_LANGS = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];
  const authorMatch = {
    $or: [
      { author: author._id },
      ...AUTHOR_LANGS.map((lang) => ({ [`translations.${lang}.author`]: author._id })),
    ],
  };

  const andClauses = [authorMatch];
  if (region) {
    andClauses.push({
      $or: [{ isGlobal: true }, { regionRestrictions: region }],
    });
  } else {
    andClauses.push({ isGlobal: true });
  }

  const requestedLanguage = language;
  const baseQuery = {
    published: true,
    ...scopedFilter(req),
    $and: andClauses,
  };

  // Optional category filter
  let categoryFilter = null;
  if (categorySlug) {
    categoryFilter = await Category.findOne({
      $or: [
        { [`translations.${requestedLanguage}.slug`]: categorySlug },
        { baseSlug: categorySlug },
        { slug: categorySlug },
      ],
    }).select('_id name slug color baseSlug translations');
    if (categoryFilter) {
      baseQuery.category = categoryFilter._id;
    }
  }

  const { resolveListingLanguage, translationTitleFilter } = require('../utils/publicContent');
  const { language: listLanguage, usedFallback } = await resolveListingLanguage(
    Article,
    baseQuery,
    requestedLanguage
  );
  const query = {
    ...baseQuery,
    ...translationTitleFilter(listLanguage),
  };

  const sort =
    sortMode === 'popular'
      ? { views: -1, publishedAt: -1 }
      : { publishedAt: -1 };
  
  const articles = await Article.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('category', 'name slug color')
    .populate('author', 'name slug avatar baseSlug defaultLanguage translations');

  const { collectTranslationAuthorIds } = require('../utils/publicContent');
  const trAuthorIds = collectTranslationAuthorIds(articles);
  let authorMap = {};
  if (trAuthorIds.length) {
    const authors = await Author.find({ _id: { $in: trAuthorIds } }).select(
      'name slug avatar baseSlug defaultLanguage translations'
    );
    authorMap = Object.fromEntries(authors.map((a) => [String(a._id), a]));
  }

  const transformedArticles = articles
    .map((article) => transformArticleForPublic(article, listLanguage, authorMap))
    .filter(Boolean);

  const total = await Article.countDocuments(query);

  // Distinct categories this author has written in (for filter chips)
  const baseCategoryQuery = {
    published: true,
    ...scopedFilter(req),
    $and: andClauses,
  };
  const categoryIds = await Article.distinct('category', baseCategoryQuery);
  const categories = await Category.find({ _id: { $in: categoryIds } })
    .select('name slug color baseSlug translations defaultLanguage')
    .sort({ name: 1 });

  const filterCategories = categories.map((cat) => {
    const tr = cat.translations?.[listLanguage] || cat.translations?.[cat.defaultLanguage];
    return {
      _id: cat._id,
      name: tr?.name || cat.name,
      slug: tr?.slug || cat.slug || cat.baseSlug,
      color: cat.color,
    };
  }).filter((c) => c.slug);

  res.json({
    success: true,
    count: transformedArticles.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 0,
    limit,
    language: listLanguage,
    requestedLanguage,
    localeFallback: usedFallback,
    region,
    sort: sortMode === 'popular' ? 'popular' : 'newest',
    category: categoryFilter
      ? {
          _id: categoryFilter._id,
          name: categoryFilter.name,
          slug: categoryFilter.slug || categoryFilter.baseSlug,
        }
      : null,
    filters: {
      categories: filterCategories,
    },
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
  const author = await Author.findOne({ _id: req.params.id });

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
  const author = await Author.findOne({ _id: req.params.id });
  
  if (!author) {
    return res.status(404).json({
      success: false,
      message: 'Author not found'
    });
  }
  
  // Check if author has articles
  const articleCount = await Article.countDocuments({
    author: author._id,
    ...scopedFilter(req),
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

