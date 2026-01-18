const Author = require('../models/Author');
const Article = require('../models/Article');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @desc    Get all authors (multilingual support)
 * @route   GET /api/authors
 * @access  Public
 */
exports.getAllAuthors = asyncHandler(async (req, res) => {
  const language = req.language || req.query.lang || 'en';
  
  const authors = await Author.find()
    .sort({ articleCount: -1, name: 1 });
  
  // Transform authors to include language-specific content
  const transformedAuthors = authors.map(author => {
    const translation = author.getTranslation(language);
    const defaultTranslation = author.getTranslation(author.defaultLanguage);
    const activeTranslation = translation || defaultTranslation;
    
    return {
      _id: author._id,
      baseSlug: author.baseSlug,
      slug: activeTranslation?.slug || author.slug,
      name: author.name,
      bio: activeTranslation?.bio || author.bio,
      avatar: author.avatar,
      email: author.email,
      socialLinks: author.socialLinks,
      articleCount: author.articleCount,
      totalViews: author.totalViews,
      language: language
    };
  });
  
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
  const author = await Author.findById(req.params.id);
  
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
  const language = req.language || req.query.lang || 'en';
  
  // Try to find by language-specific slug or base slug
  let author = await Author.findOne({
    $or: [
      { [`translations.${language}.slug`]: slug },
      { baseSlug: slug },
      { slug: slug } // Legacy support
    ]
  });
  
  if (!author) {
    return res.status(404).json({
      success: false,
      message: 'Author not found'
    });
  }
  
  // Get translation for current language
  const translation = author.getTranslation(language);
  const defaultTranslation = author.getTranslation(author.defaultLanguage);
  const activeTranslation = translation || defaultTranslation;
  
  res.json({
    success: true,
    data: {
      _id: author._id,
      baseSlug: author.baseSlug,
      slug: activeTranslation?.slug || author.slug,
      name: author.name,
      bio: activeTranslation?.bio || author.bio,
      avatar: author.avatar,
      email: author.email,
      socialLinks: author.socialLinks,
      articleCount: author.articleCount,
      totalViews: author.totalViews,
      language: language
    }
  });
});

/**
 * @desc    Get articles by author (multilingual support)
 * @route   GET /api/authors/:slug/articles
 * @access  Public
 */
exports.getAuthorArticles = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const language = req.language || req.query.lang || 'en';
  const region = req.region || req.query.region || 'US';
  
  // Find author by slug
  let author = await Author.findOne({
    $or: [
      { [`translations.${language}.slug`]: slug },
      { baseSlug: slug },
      { slug: slug } // Legacy support
    ]
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
    published: true 
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
    .populate('author', 'name slug avatar');
  
  // Transform articles to include language-specific content
  const transformedArticles = articles.map(article => {
    const translation = article.getTranslation(language);
    const defaultTranslation = article.getTranslation(article.defaultLanguage);
    const activeTranslation = translation || defaultTranslation;
    
    if (!activeTranslation) {
      return null;
    }
    
    return {
      _id: article._id,
      baseSlug: article.baseSlug,
      slug: activeTranslation.slug,
      title: activeTranslation.title,
      excerpt: activeTranslation.excerpt,
      content: activeTranslation.content,
      imageUrl: article.imageUrl,
      category: article.category,
      author: article.author,
      tags: article.tags,
      publishedAt: article.publishedAt,
      views: article.views,
      likes: article.likes,
      readTime: article.readTime,
      language: language
    };
  }).filter(article => article !== null);
  
  const total = await Article.countDocuments(query);
  
  // Get author translation
  const authorTranslation = author.getTranslation(language);
  const defaultAuthorTranslation = author.getTranslation(author.defaultLanguage);
  const activeAuthorTranslation = authorTranslation || defaultAuthorTranslation;
  
  res.json({
    success: true,
    count: transformedArticles.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    language,
    region,
    author: {
      _id: author._id,
      baseSlug: author.baseSlug,
      slug: activeAuthorTranslation?.slug || author.slug,
      name: author.name,
      avatar: author.avatar,
      bio: activeAuthorTranslation?.bio || author.bio,
      socialLinks: author.socialLinks
    },
    data: transformedArticles
  });
});

/**
 * @desc    Create new author
 * @route   POST /api/authors
 * @access  Private/Admin
 */
exports.createAuthor = asyncHandler(async (req, res) => {
  const { name, bio, avatar, email, socialLinks } = req.body;
  
  const author = await Author.create({
    name,
    bio,
    avatar,
    email,
    socialLinks: socialLinks || {}
  });
  
  res.status(201).json({
    success: true,
    data: author
  });
});

/**
 * @desc    Update author
 * @route   PUT /api/authors/:id
 * @access  Private/Admin
 */
exports.updateAuthor = asyncHandler(async (req, res) => {
  const author = await Author.findById(req.params.id);
  
  if (!author) {
    return res.status(404).json({
      success: false,
      message: 'Author not found'
    });
  }
  
  const { name, bio, avatar, email, socialLinks } = req.body;
  
  if (name) author.name = name;
  if (bio !== undefined) author.bio = bio;
  if (avatar !== undefined) author.avatar = avatar;
  if (email) author.email = email;
  if (socialLinks) {
    author.socialLinks = { ...author.socialLinks, ...socialLinks };
  }
  
  await author.save();
  
  res.json({
    success: true,
    data: author
  });
});

/**
 * @desc    Delete author
 * @route   DELETE /api/authors/:id
 * @access  Private/Admin
 */
exports.deleteAuthor = asyncHandler(async (req, res) => {
  const author = await Author.findById(req.params.id);
  
  if (!author) {
    return res.status(404).json({
      success: false,
      message: 'Author not found'
    });
  }
  
  // Check if author has articles
  const articleCount = await Article.countDocuments({ author: author._id });
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

