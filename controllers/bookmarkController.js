const Bookmark = require('../models/Bookmark');
const Article = require('../models/Article');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @desc    Add bookmark
 * @route   POST /api/bookmarks
 * @access  Private
 */
exports.addBookmark = asyncHandler(async (req, res) => {
  const { articleId } = req.body;
  const userId = req.user._id;

  if (!articleId) {
    return res.status(400).json({
      success: false,
      message: 'Article ID is required'
    });
  }

  // Check if article exists
  const article = await Article.findById(articleId);
  if (!article) {
    return res.status(404).json({
      success: false,
      message: 'Article not found'
    });
  }

  // Check if already bookmarked
  const existing = await Bookmark.findOne({ user: userId, article: articleId });
  if (existing) {
    return res.json({
      success: true,
      message: 'Article already bookmarked',
      data: existing
    });
  }

  // Create bookmark
  const bookmark = await Bookmark.create({
    user: userId,
    article: articleId
  });

  // Populate article details
  await bookmark.populate('article', 'title slug imageUrl excerpt publishedAt views');

  res.status(201).json({
    success: true,
    message: 'Article bookmarked successfully',
    data: bookmark
  });
});

/**
 * @desc    Remove bookmark
 * @route   DELETE /api/bookmarks/:articleId
 * @access  Private
 */
exports.removeBookmark = asyncHandler(async (req, res) => {
  const { articleId } = req.params;
  const userId = req.user._id;

  const bookmark = await Bookmark.findOneAndDelete({
    user: userId,
    article: articleId
  });

  if (!bookmark) {
    return res.status(404).json({
      success: false,
      message: 'Bookmark not found'
    });
  }

  res.json({
    success: true,
    message: 'Bookmark removed successfully'
  });
});

/**
 * @desc    Get user bookmarks
 * @route   GET /api/bookmarks
 * @access  Private
 */
exports.getBookmarks = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const bookmarks = await Bookmark.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: 'article',
      select: 'title slug imageUrl excerpt publishedAt views category author',
      populate: [
        { path: 'category', select: 'name slug color' },
        { path: 'author', select: 'name slug avatar' }
      ]
    });

  const total = await Bookmark.countDocuments({ user: userId });

  res.json({
    success: true,
    count: bookmarks.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: bookmarks
  });
});

/**
 * @desc    Check if article is bookmarked
 * @route   GET /api/bookmarks/check/:articleId
 * @access  Private
 */
exports.checkBookmark = asyncHandler(async (req, res) => {
  const { articleId } = req.params;
  const userId = req.user._id;

  const bookmark = await Bookmark.findOne({
    user: userId,
    article: articleId
  });

  res.json({
    success: true,
    isBookmarked: !!bookmark
  });
});

/**
 * @desc    Get bookmark count for article
 * @route   GET /api/bookmarks/count/:articleId
 * @access  Public
 */
exports.getBookmarkCount = asyncHandler(async (req, res) => {
  const { articleId } = req.params;

  const count = await Bookmark.countDocuments({ article: articleId });

  res.json({
    success: true,
    count
  });
});


