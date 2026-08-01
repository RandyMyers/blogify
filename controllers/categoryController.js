const Category = require('../models/Category');
const Article = require('../models/Article');
const { asyncHandler } = require('../middleware/errorHandler');
const { scopedFilter } = require('../utils/tenantScope');
const { formatPopulatedAuthor, formatPopulatedCategory } = require('../utils/publicContent');
const { isObjectIdString } = require('../utils/objectIdUtils');

async function getPostCountByCategoryIds(categoryIds, tenantId) {
  if (!categoryIds.length) return {};

  const match = {
    category: { $in: categoryIds },
    published: true,
  };
  if (tenantId) match.tenantId = tenantId;

  const rows = await Article.aggregate([
    { $match: match },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);

  return Object.fromEntries(rows.map((row) => [String(row._id), row.count]));
}

/**
 * @desc    Get all categories (multilingual support)
 * @route   GET /api/categories
 * @access  Public
 */
exports.getAllCategories = asyncHandler(async (req, res) => {
  const language = (req.query.lang || req.language || 'en').toLowerCase();
  const categories = await Category.find({})
    .sort({ postCount: -1, name: 1 });

  const postCounts = await getPostCountByCategoryIds(
    categories.map((category) => category._id),
    req.tenantId
  );
  
  // Transform categories to include language-specific content
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
      seo: {
        metaTitle: activeTranslation.metaTitle || '',
        metaDescription: activeTranslation.metaDescription || '',
      },
      color: category.color,
      imageUrl: category.imageUrl,
      isPopular: category.isPopular,
      postCount: postCounts[String(category._id)] || 0,
      language: language
    };
  }).filter(category => category !== null);
  
  res.json({
    success: true,
    count: transformedCategories.length,
    language,
    data: transformedCategories
  });
});

/**
 * @desc    Get popular categories (multilingual support)
 * @route   GET /api/categories/popular
 * @access  Public
 */
exports.getPopularCategories = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 4;
  const language = (req.query.lang || req.language || 'en').toLowerCase();
  
  const categories = await Category.find({ isPopular: true })
    .sort({ postCount: -1 })
    .limit(limit);

  const postCounts = await getPostCountByCategoryIds(
    categories.map((category) => category._id),
    req.tenantId
  );
  
  // Transform categories to include language-specific content
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
      seo: {
        metaTitle: activeTranslation.metaTitle || '',
        metaDescription: activeTranslation.metaDescription || '',
      },
      color: category.color,
      imageUrl: category.imageUrl,
      isPopular: category.isPopular,
      postCount: postCounts[String(category._id)] || 0,
      language: language
    };
  }).filter(category => category !== null);
  
  res.json({
    success: true,
    count: transformedCategories.length,
    language,
    data: transformedCategories
  });
});

/**
 * @desc    List all categories for admin (raw documents, no locale transform)
 * @route   GET /api/categories/admin/list
 * @access  Private/Admin
 */
exports.getCategoriesForAdmin = asyncHandler(async (req, res) => {
  const categories = await Category.find({})
    .sort({ postCount: -1, baseSlug: 1 });

  res.json({
    success: true,
    count: categories.length,
    data: categories,
  });
});

/**
 * @desc    Get single category by ID
 * @route   GET /api/categories/admin/:id
 * @access  Private/Admin
 */
exports.getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id });
  
  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }
  
  res.json({
    success: true,
    data: category
  });
});

/**
 * @desc    Get single category by slug (multilingual support)
 * @route   GET /api/categories/:slug
 * @access  Public
 */
exports.getCategoryBySlug = asyncHandler(async (req, res) => {
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

  let category = await Category.findOne({
    $or: slugOr,
  });
  
  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }
  
  // Get translation for current language
  const translation = category.getTranslation(language);
  const defaultTranslation = category.getTranslation(category.defaultLanguage);
  const activeTranslation = translation || defaultTranslation;
  
  if (!activeTranslation) {
    return res.status(404).json({
      success: false,
      message: 'Translation not available'
    });
  }

  const postCounts = await getPostCountByCategoryIds([category._id], req.tenantId);
  
  res.json({
    success: true,
    data: {
      _id: category._id,
      baseSlug: category.baseSlug,
      slug: activeTranslation.slug,
      name: activeTranslation.name,
      description: activeTranslation.description,
      seo: {
        metaTitle: activeTranslation.metaTitle || '',
        metaDescription: activeTranslation.metaDescription || '',
      },
      color: category.color,
      imageUrl: category.imageUrl,
      isPopular: category.isPopular,
      postCount: postCounts[String(category._id)] || 0,
      language: language
    }
  });
});

/**
 * @desc    Get articles by category (multilingual support)
 * @route   GET /api/categories/:slug/articles
 * @access  Public
 */
exports.getCategoryArticles = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const language = (req.query.lang || req.language || 'en').toLowerCase();
  const region = req.region || req.query.region || 'US';
  
  // Find category by slug
const slugOr = [
    { [`translations.${language}.slug`]: slug },
    { baseSlug: slug },
    { slug: slug },
  ];
  if (isObjectIdString(slug)) {
    slugOr.push({ _id: slug });
  }

  let category = await Category.findOne({
    $or: slugOr,
  });
  
  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }
  
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  // Build query with region filtering
  const query = { 
    category: category._id, 
    published: true,
    ...scopedFilter(req),
    [`translations.${language}.title`]: { $exists: true, $type: 'string', $regex: /\S/ },
  };
  
  // Region filtering
  if (region) {
    query.$and = [
      {
        $or: [
          { isGlobal: true },
          { regionRestrictions: region }
        ],
      },
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
  
  const transformedArticles = articles.map((article) => {
    const activeTranslation = article.translations?.[language];
    if (!activeTranslation?.title) {
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
      category: formatPopulatedCategory(article.category, language),
      author: formatPopulatedAuthor(article.author, language),
      tags: article.tags,
      publishedAt: article.publishedAt,
      views: article.views,
      likes: article.likes,
      readTime: article.readTime,
      language: language
    };
  }).filter(article => article !== null);
  
  const total = await Article.countDocuments(query);
  
  // Get category translation
  const categoryTranslation = category.getTranslation(language);
  const defaultCategoryTranslation = category.getTranslation(category.defaultLanguage);
  const activeCategoryTranslation = categoryTranslation || defaultCategoryTranslation;
  
  res.json({
    success: true,
    count: transformedArticles.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    language,
    region,
    category: {
      _id: category._id,
      baseSlug: category.baseSlug,
      slug: activeCategoryTranslation.slug,
      name: activeCategoryTranslation.name,
      color: category.color,
      description: activeCategoryTranslation.description
    },
    data: transformedArticles
  });
});

/**
 * @desc    Create new category
 * @route   POST /api/categories
 * @access  Private/Admin
 */
exports.createCategory = asyncHandler(async (req, res) => {
  const {
    baseSlug,
    defaultLanguage,
    translations,
    name,
    description,
    color,
    imageUrl,
    isPopular
  } = req.body;

  const effectiveDefaultLanguage = defaultLanguage || 'en';
  const defaultTranslation = translations?.[effectiveDefaultLanguage] || {};
  
  const category = await Category.create({
    baseSlug: baseSlug || defaultTranslation.slug,
    defaultLanguage: effectiveDefaultLanguage,
    translations: translations || {},
    name: name || defaultTranslation.name || '',
    description: description || defaultTranslation.description || '',
    color: color || 'teal',
    imageUrl,
    isPopular: isPopular || false
  });
  
  res.status(201).json({
    success: true,
    data: category
  });
});

/**
 * @desc    Update category
 * @route   PUT /api/categories/:id
 * @access  Private/Admin
 */
exports.updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id });
  
  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }
  
  const {
    baseSlug,
    defaultLanguage,
    translations,
    name,
    description,
    color,
    imageUrl,
    isPopular
  } = req.body;
  
  if (baseSlug !== undefined) category.baseSlug = baseSlug;
  if (defaultLanguage !== undefined) category.defaultLanguage = defaultLanguage;
  if (translations !== undefined) {
    Object.keys(translations).forEach((lang) => {
      const incoming = translations[lang];
      if (!incoming) return;

      const existing = category.translations[lang];
      if (existing) {
        const existingPlain =
          typeof existing.toObject === 'function'
            ? existing.toObject()
            : { ...existing };
        category.translations[lang] = { ...existingPlain, ...incoming };
      } else {
        category.translations[lang] = incoming;
      }
    });
    category.markModified('translations');
  }
  if (name) category.name = name;
  if (description !== undefined) category.description = description;
  if (color) category.color = color;
  if (imageUrl !== undefined) category.imageUrl = imageUrl;
  if (typeof isPopular === 'boolean') category.isPopular = isPopular;
  
  await category.save();
  
  res.json({
    success: true,
    data: category
  });
});

/**
 * @desc    Delete category
 * @route   DELETE /api/categories/:id
 * @access  Private/Admin
 */
exports.deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id });
  
  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }
  
  // Check if category has articles
  const articleCount = await Article.countDocuments({
    category: category._id,
  });
  if (articleCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete category with ${articleCount} article(s). Please reassign or delete articles first.`
    });
  }
  
  await category.deleteOne();
  
  res.json({
    success: true,
    message: 'Category deleted successfully'
  });
});

