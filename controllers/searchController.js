const Article = require('../models/Article');
const Category = require('../models/Category');
const Author = require('../models/Author');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @desc    Search articles (multilingual support)
 * @route   GET /api/search
 * @access  Public
 */
exports.searchArticles = asyncHandler(async (req, res) => {
  const query = req.query.q;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const language = req.language || req.query.lang || 'en';
  const region = req.region || req.query.region || 'US';
  
  if (!query || query.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }
  
  const category = req.query.category;
  const author = req.query.author;
  
  const articles = await Article.search(query.trim(), {
    limit,
    skip,
    category,
    author,
    language,
    region
  });
  
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
          slug: categoryTranslation.slug || article.category.slug
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
      author: article.author,
      tags: article.tags,
      publishedAt: article.publishedAt,
      views: article.views,
      likes: article.likes,
      readTime: article.readTime,
      language: language
    };
  }).filter(article => article !== null);
  
  // Count total (with region filtering)
  const countQuery = {
    published: true,
    $or: [
      { isGlobal: true },
      { regionRestrictions: region }
    ]
  };
  
  if (category) countQuery.category = category;
  if (author) countQuery.author = author;
  
  const total = await Article.countDocuments(countQuery);
  
  res.json({
    success: true,
    query: query.trim(),
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
 * @desc    Search categories (multilingual support)
 * @route   GET /api/search/categories
 * @access  Public
 */
exports.searchCategories = asyncHandler(async (req, res) => {
  const query = req.query.q;
  const language = req.language || req.query.lang || 'en';
  
  if (!query || query.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }
  
  // Search in translations
  const categories = await Category.find({
    $or: [
      { [`translations.${language}.name`]: { $regex: query.trim(), $options: 'i' } },
      { [`translations.${language}.description`]: { $regex: query.trim(), $options: 'i' } },
      // Fallback to legacy fields
      { name: { $regex: query.trim(), $options: 'i' } },
      { description: { $regex: query.trim(), $options: 'i' } }
    ]
  })
    .sort({ postCount: -1 })
    .limit(10);
  
  // Transform categories
  const transformedCategories = categories.map(category => {
    const translation = category.getTranslation(language);
    const defaultTranslation = category.getTranslation(category.defaultLanguage);
    const activeTranslation = translation || defaultTranslation;
    
    if (!activeTranslation) {
      return null;
    }
    
    return {
      _id: category._id,
      baseSlug: category.baseSlug,
      slug: activeTranslation.slug,
      name: activeTranslation.name,
      description: activeTranslation.description,
      color: category.color,
      imageUrl: category.imageUrl,
      isPopular: category.isPopular,
      postCount: category.postCount,
      language: language
    };
  }).filter(category => category !== null);
  
  res.json({
    success: true,
    query: query.trim(),
    count: transformedCategories.length,
    language,
    data: transformedCategories
  });
});

/**
 * @desc    Search authors (multilingual support)
 * @route   GET /api/search/authors
 * @access  Public
 */
exports.searchAuthors = asyncHandler(async (req, res) => {
  const query = req.query.q;
  const language = req.language || req.query.lang || 'en';
  
  if (!query || query.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }
  
  // Search in translations and name
  const authors = await Author.find({
    $or: [
      { name: { $regex: query.trim(), $options: 'i' } },
      { [`translations.${language}.bio`]: { $regex: query.trim(), $options: 'i' } },
      // Fallback to legacy bio
      { bio: { $regex: query.trim(), $options: 'i' } }
    ]
  })
    .sort({ articleCount: -1 })
    .limit(10);
  
  // Transform authors
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
    query: query.trim(),
    count: transformedAuthors.length,
    language,
    data: transformedAuthors
  });
});

/**
 * @desc    Global search (articles, categories, authors) - multilingual support
 * @route   GET /api/search/all
 * @access  Public
 */
exports.globalSearch = asyncHandler(async (req, res) => {
  const query = req.query.q;
  const language = req.language || req.query.lang || 'en';
  const region = req.region || req.query.region || 'US';
  
  if (!query || query.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }
  
  const searchQuery = query.trim();
  const limit = 5; // Limit per type
  
  // Search articles
  const articles = await Article.search(searchQuery, { 
    limit,
    language,
    region
  });
  
  // Transform articles
  const transformedArticles = articles.map(article => {
    const translation = article.getTranslation(language);
    const defaultTranslation = article.getTranslation(article.defaultLanguage);
    const activeTranslation = translation || defaultTranslation;
    
    if (!activeTranslation) return null;
    
    return {
      _id: article._id,
      baseSlug: article.baseSlug,
      slug: activeTranslation.slug,
      title: activeTranslation.title,
      excerpt: activeTranslation.excerpt,
      imageUrl: article.imageUrl,
      category: article.category,
      author: article.author,
      language: language
    };
  }).filter(article => article !== null);
  
  // Search categories
  const categories = await Category.find({
    $or: [
      { [`translations.${language}.name`]: { $regex: searchQuery, $options: 'i' } },
      { [`translations.${language}.description`]: { $regex: searchQuery, $options: 'i' } },
      { name: { $regex: searchQuery, $options: 'i' } },
      { description: { $regex: searchQuery, $options: 'i' } }
    ]
  })
    .sort({ postCount: -1 })
    .limit(limit);
  
  // Transform categories
  const transformedCategories = categories.map(category => {
    const translation = category.getTranslation(language);
    const defaultTranslation = category.getTranslation(category.defaultLanguage);
    const activeTranslation = translation || defaultTranslation;
    
    if (!activeTranslation) return null;
    
    return {
      _id: category._id,
      baseSlug: category.baseSlug,
      slug: activeTranslation.slug,
      name: activeTranslation.name,
      description: activeTranslation.description,
      color: category.color,
      postCount: category.postCount,
      language: language
    };
  }).filter(category => category !== null);
  
  // Search authors
  const authors = await Author.find({
    $or: [
      { name: { $regex: searchQuery, $options: 'i' } },
      { [`translations.${language}.bio`]: { $regex: searchQuery, $options: 'i' } },
      { bio: { $regex: searchQuery, $options: 'i' } }
    ]
  })
    .sort({ articleCount: -1 })
    .limit(limit);
  
  // Transform authors
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
      articleCount: author.articleCount,
      language: language
    };
  });
  
  res.json({
    success: true,
    query: searchQuery,
    language,
    region,
    data: {
      articles: {
        count: transformedArticles.length,
        items: transformedArticles
      },
      categories: {
        count: transformedCategories.length,
        items: transformedCategories
      },
      authors: {
        count: transformedAuthors.length,
        items: transformedAuthors
      }
    }
  });
});


