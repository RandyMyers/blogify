const Comment = require('../models/Comment');
const Article = require('../models/Article');
const { asyncHandler } = require('../middleware/errorHandler');
const { syncCommentCount } = require('../utils/commentCount');
const {
  sanitizeCommentBody,
  sanitizeAuthorName,
  sanitizeEmail,
  isValidEmail,
  hashIp,
  getClientIp,
  toPublicComment,
  extractUrlsFromCommentBody,
} = require('../utils/sanitizeComment');

/** Admin lists include tenant-scoped comments plus legacy rows without tenantId. */
const adminTenantFilter = (req) => {
  if (!req.tenantId) return {};
  return {
    $or: [
      { tenantId: req.tenantId },
      { tenantId: null },
      { tenantId: { $exists: false } },
    ],
  };
};

const publicTenantFilter = (req) => (req.tenantId ? { tenantId: req.tenantId } : {});

const resolveArticleSlug = (article, language = 'en') => {
  const tr = article.translations?.[language] || article.translations?.[article.defaultLanguage];
  return tr?.slug || article.slug || article.baseSlug || '';
};

const escapeCsv = (value) => {
  const s = String(value ?? '').replace(/"/g, '""');
  return `"${s}"`;
};

/**
 * @desc    List approved comments for an article (public, threaded)
 * @route   GET /api/comments/article/:articleId
 */
exports.getArticleComments = asyncHandler(async (req, res) => {
  const { articleId } = req.params;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const skip = (page - 1) * limit;
  const sort = req.query.sort === 'newest' ? -1 : 1;

  const article = await Article.findOne({
    _id: articleId,
    published: true,
    ...publicTenantFilter(req),
  }).select('_id commentCount');

  if (!article) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }

  const baseQuery = {
    articleId,
    status: 'approved',
    ...publicTenantFilter(req),
  };

  const topQuery = { ...baseQuery, parentId: null };

  const [topLevel, total] = await Promise.all([
    Comment.find(topQuery).sort({ createdAt: sort }).skip(skip).limit(limit),
    Comment.countDocuments(topQuery),
  ]);

  const parentIds = topLevel.map((c) => c._id);
  let replies = [];
  if (parentIds.length > 0) {
    replies = await Comment.find({
      ...baseQuery,
      parentId: { $in: parentIds },
    }).sort({ createdAt: 1 });
  }

  const repliesByParent = replies.reduce((acc, reply) => {
    const key = String(reply.parentId);
    if (!acc[key]) acc[key] = [];
    acc[key].push(toPublicComment(reply));
    return acc;
  }, {});

  const data = topLevel.map((comment) => ({
    ...toPublicComment(comment),
    replies: repliesByParent[String(comment._id)] || [],
  }));

  res.json({
    success: true,
    count: data.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    commentCount: article.commentCount ?? total,
    data,
  });
});

/**
 * @desc    Submit a comment or reply (public, pending moderation)
 * @route   POST /api/comments/article/:articleId
 */
exports.createComment = asyncHandler(async (req, res) => {
  const { articleId } = req.params;

  if (req.body.website_url_hidden) {
    return res.status(201).json({
      success: true,
      message: 'Thank you — your comment is awaiting moderation.',
    });
  }

  const authorName = sanitizeAuthorName(req.body.authorName);
  const authorEmail = sanitizeEmail(req.body.authorEmail);
  const body = sanitizeCommentBody(req.body.body);
  const language = (req.body.language || 'en').toLowerCase();
  const parentId = req.body.parentId || null;

  if (!authorName || !authorEmail || !body) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and comment are required',
    });
  }

  if (!isValidEmail(authorEmail)) {
    return res.status(400).json({ success: false, message: 'Invalid email address' });
  }

  const article = await Article.findOne({
    _id: articleId,
    published: true,
    ...publicTenantFilter(req),
  });

  if (!article) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }

  if (parentId) {
    const parent = await Comment.findOne({
      _id: parentId,
      articleId: article._id,
      status: { $in: ['approved', 'pending'] },
    });
    if (!parent) {
      return res.status(400).json({ success: false, message: 'Parent comment not found' });
    }
  }

  const tenantId = article.tenantId || req.tenantId || undefined;

  const comment = await Comment.create({
    ...(tenantId ? { tenantId } : {}),
    articleId: article._id,
    articleSlug: resolveArticleSlug(article, language),
    parentId: parentId || null,
    authorName,
    authorEmail,
    authorWebsite: '',
    body,
    language,
    status: 'pending',
    ipHash: hashIp(getClientIp(req)),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
  });

  res.status(201).json({
    success: true,
    message: 'Thank you — your comment is awaiting moderation.',
    data: { _id: comment._id, status: comment.status, parentId: comment.parentId },
  });
});

/**
 * @desc    Admin comment stats
 * @route   GET /api/comments/admin/stats
 */
exports.getAdminStats = asyncHandler(async (req, res) => {
  const base = adminTenantFilter(req);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [pending, approved, approvedToday, spam, rejected, total] = await Promise.all([
    Comment.countDocuments({ ...base, status: 'pending' }),
    Comment.countDocuments({ ...base, status: 'approved' }),
    Comment.countDocuments({ ...base, status: 'approved', approvedAt: { $gte: startOfDay } }),
    Comment.countDocuments({ ...base, status: 'spam' }),
    Comment.countDocuments({ ...base, status: 'rejected' }),
    Comment.countDocuments(base),
  ]);

  res.json({
    success: true,
    data: { pending, approved, approvedToday, spam, rejected, total },
  });
});

/**
 * @desc    Admin list comments
 * @route   GET /api/comments/admin
 */
exports.getAdminComments = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;
  const status = req.query.status;
  const articleId = req.query.articleId;
  const search = String(req.query.search || '').trim();

  const query = { ...adminTenantFilter(req) };

  if (status && status !== 'all') {
    query.status = status;
  }

  if (articleId) {
    query.articleId = articleId;
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { authorName: regex },
        { authorEmail: regex },
        { body: regex },
        { articleSlug: regex },
      ],
    });
  }

  const [comments, total] = await Promise.all([
    Comment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('articleId', 'title baseSlug defaultLanguage translations')
      .populate('parentId', 'authorName body status'),
    Comment.countDocuments(query),
  ]);

  res.json({
    success: true,
    count: comments.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    data: comments,
  });
});

/**
 * @desc    Admin list URLs found in comment bodies
 * @route   GET /api/comments/admin/urls
 */
exports.getAdminCommentUrls = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
  const status = req.query.status;
  const search = String(req.query.search || '').trim().toLowerCase();

  const query = { ...adminTenantFilter(req) };
  if (status && status !== 'all') {
    query.status = status;
  }

  const comments = await Comment.find(query)
    .select('body status authorName createdAt articleSlug _id')
    .sort({ createdAt: -1 })
    .lean();

  const urlMap = new Map();

  for (const comment of comments) {
    const urls = extractUrlsFromCommentBody(comment.body);
    for (const url of urls) {
      if (search && !url.toLowerCase().includes(search)) continue;

      if (!urlMap.has(url)) {
        urlMap.set(url, {
          url,
          count: 0,
          lastUsedAt: null,
          statusCounts: { pending: 0, approved: 0, spam: 0, rejected: 0 },
          recentComments: [],
        });
      }

      const entry = urlMap.get(url);
      entry.count += 1;
      const statusKey = comment.status || 'pending';
      entry.statusCounts[statusKey] = (entry.statusCounts[statusKey] || 0) + 1;

      const createdAt = comment.createdAt ? new Date(comment.createdAt) : null;
      if (createdAt && (!entry.lastUsedAt || createdAt > entry.lastUsedAt)) {
        entry.lastUsedAt = createdAt;
      }

      if (entry.recentComments.length < 5) {
        entry.recentComments.push({
          _id: comment._id,
          authorName: comment.authorName,
          status: comment.status,
          articleSlug: comment.articleSlug,
          createdAt: comment.createdAt,
        });
      }
    }
  }

  const rows = [...urlMap.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return new Date(b.lastUsedAt || 0) - new Date(a.lastUsedAt || 0);
  });

  const total = rows.length;
  const skip = (page - 1) * limit;
  const data = rows.slice(skip, skip + limit);

  res.json({
    success: true,
    count: data.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    data,
  });
});

/**
 * @desc    Admin get single comment
 * @route   GET /api/comments/admin/:id
 */
exports.getAdminComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findOne({
    _id: req.params.id,
    ...adminTenantFilter(req),
  })
    .populate('articleId', 'title baseSlug defaultLanguage translations')
    .populate('parentId', 'authorName body status');

  if (!comment) {
    return res.status(404).json({ success: false, message: 'Comment not found' });
  }

  res.json({ success: true, data: comment });
});

/**
 * @desc    Admin update comment status/body
 * @route   PATCH /api/comments/admin/:id
 */
exports.updateAdminComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findOne({
    _id: req.params.id,
    ...adminTenantFilter(req),
  });

  if (!comment) {
    return res.status(404).json({ success: false, message: 'Comment not found' });
  }

  const { status, body } = req.body;
  const allowed = ['pending', 'approved', 'spam', 'rejected'];
  const prevStatus = comment.status;

  if (status !== undefined) {
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    comment.status = status;
    if (status === 'approved') {
      comment.approvedAt = new Date();
      comment.approvedBy = req.user?._id || null;
    } else {
      comment.approvedAt = null;
      comment.approvedBy = null;
    }
  }

  if (body !== undefined) {
    const cleaned = sanitizeCommentBody(body);
    if (!cleaned) {
      return res.status(400).json({ success: false, message: 'Comment body cannot be empty' });
    }
    comment.body = cleaned;
  }

  await comment.save();

  if (prevStatus !== comment.status && (prevStatus === 'approved' || comment.status === 'approved')) {
    await syncCommentCount(comment.articleId);
  }

  res.json({ success: true, data: comment });
});

/**
 * @desc    Admin bulk update comment status
 * @route   PATCH /api/comments/admin/bulk/status
 */
exports.bulkUpdateAdminComments = asyncHandler(async (req, res) => {
  const { ids, status } = req.body;
  const allowed = ['pending', 'approved', 'spam', 'rejected'];

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'ids array is required' });
  }
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const update = {
    status,
    approvedAt: status === 'approved' ? new Date() : null,
    approvedBy: status === 'approved' ? req.user?._id || null : null,
  };

  const filter = { _id: { $in: ids }, ...adminTenantFilter(req) };
  const result = await Comment.updateMany(filter, { $set: update });

  const affected = await Comment.find(filter).select('articleId');
  const articleIds = [...new Set(affected.map((c) => String(c.articleId)))];
  await Promise.all(articleIds.map((id) => syncCommentCount(id)));

  res.json({
    success: true,
    modified: result.modifiedCount,
  });
});

/**
 * @desc    Admin delete comment
 * @route   DELETE /api/comments/admin/:id
 */
exports.deleteAdminComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findOneAndDelete({
    _id: req.params.id,
    ...adminTenantFilter(req),
  });

  if (!comment) {
    return res.status(404).json({ success: false, message: 'Comment not found' });
  }

  await Comment.deleteMany({ parentId: comment._id });
  if (comment.status === 'approved') {
    await syncCommentCount(comment.articleId);
  }

  res.json({ success: true, message: 'Comment deleted' });
});

/**
 * @desc    Admin bulk delete comments
 * @route   DELETE /api/comments/admin/bulk
 */
exports.bulkDeleteAdminComments = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'ids array is required' });
  }

  const filter = { _id: { $in: ids }, ...adminTenantFilter(req) };
  const comments = await Comment.find(filter).select('articleId status');
  const articleIds = [
    ...new Set(comments.filter((c) => c.status === 'approved').map((c) => String(c.articleId))),
  ];

  await Comment.deleteMany({ parentId: { $in: ids } });
  await Comment.deleteMany(filter);

  await Promise.all(articleIds.map((id) => syncCommentCount(id)));

  res.json({ success: true, deleted: comments.length });
});

/**
 * @desc    Export comments as CSV (admin)
 * @route   GET /api/comments/admin/export
 */
exports.exportAdminComments = asyncHandler(async (req, res) => {
  const status = req.query.status;
  const query = { ...adminTenantFilter(req) };
  if (status && status !== 'all') query.status = status;

  const comments = await Comment.find(query)
    .sort({ createdAt: -1 })
    .limit(5000)
    .populate('articleId', 'title baseSlug defaultLanguage translations');

  const header = ['Date', 'Status', 'Author', 'Email', 'Article', 'Comment', 'Reply To', 'Language'];
  const rows = comments.map((c) => {
    const article = c.articleId;
    const lang = article?.defaultLanguage || 'en';
    const title =
      article?.translations?.[lang]?.title || article?.title || article?.baseSlug || c.articleSlug || '';
    return [
      c.createdAt ? new Date(c.createdAt).toISOString() : '',
      c.status,
      c.authorName,
      c.authorEmail,
      title,
      c.body,
      c.parentId ? 'yes' : 'no',
      c.language,
    ]
      .map(escapeCsv)
      .join(',');
  });

  const csv = [header.map(escapeCsv).join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="comments-export.csv"');
  res.send(csv);
});

/**
 * @desc    Comment counts for an article (admin)
 * @route   GET /api/comments/admin/article/:articleId/counts
 */
exports.getArticleCommentCounts = asyncHandler(async (req, res) => {
  const { articleId } = req.params;
  const base = { articleId, ...adminTenantFilter(req) };

  const [pending, approved, spam, rejected, total] = await Promise.all([
    Comment.countDocuments({ ...base, status: 'pending' }),
    Comment.countDocuments({ ...base, status: 'approved' }),
    Comment.countDocuments({ ...base, status: 'spam' }),
    Comment.countDocuments({ ...base, status: 'rejected' }),
    Comment.countDocuments(base),
  ]);

  res.json({
    success: true,
    data: { pending, approved, spam, rejected, total },
  });
});
