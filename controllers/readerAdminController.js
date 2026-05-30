const User = require('../models/users');
const Comment = require('../models/Comment');
const { asyncHandler } = require('../middleware/errorHandler');

const formatAdminReader = (user, stats = {}) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  emailVerified: Boolean(user.emailVerified),
  isBanned: Boolean(user.isBanned),
  bannedAt: user.bannedAt || null,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
  commentCount: stats.commentCount ?? 0,
  pendingCommentCount: stats.pendingCommentCount ?? 0,
});

/**
 * @desc    List reader accounts
 * @route   GET /api/admin/readers
 */
exports.getReaders = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
  const skip = (page - 1) * limit;
  const search = String(req.query.search || '').trim();
  const status = req.query.status;

  const query = { role: 'reader' };

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    query.$or = [{ username: regex }, { email: regex }];
  }

  if (status === 'verified') {
    query.emailVerified = true;
    query.isBanned = { $ne: true };
  } else if (status === 'unverified') {
    query.emailVerified = false;
    query.isBanned = { $ne: true };
  } else if (status === 'banned') {
    query.isBanned = true;
  }

  const [readers, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-password -refreshToken -emailVerificationToken -passwordResetToken'),
    User.countDocuments(query),
  ]);

  const readerIds = readers.map((r) => r._id);
  let statsMap = {};

  if (readerIds.length > 0) {
    const commentAgg = await Comment.aggregate([
      { $match: { userId: { $in: readerIds } } },
      {
        $group: {
          _id: '$userId',
          commentCount: { $sum: 1 },
          pendingCommentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
        },
      },
    ]);

    statsMap = commentAgg.reduce((acc, row) => {
      acc[String(row._id)] = row;
      return acc;
    }, {});
  }

  res.json({
    success: true,
    data: readers.map((r) => formatAdminReader(r, statsMap[String(r._id)] || {})),
    page,
    pages: Math.ceil(total / limit) || 1,
    total,
  });
});

/**
 * @desc    Ban or unban a reader
 * @route   PATCH /api/admin/readers/:id/ban
 */
exports.updateReaderBan = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user || user.role !== 'reader') {
    return res.status(404).json({ success: false, message: 'Reader not found' });
  }

  const isBanned =
    req.body.isBanned !== undefined ? Boolean(req.body.isBanned) : !user.isBanned;

  user.isBanned = isBanned;
  user.bannedAt = isBanned ? new Date() : null;
  await user.save();

  res.json({
    success: true,
    data: formatAdminReader(user),
    message: isBanned ? 'Reader banned' : 'Reader unbanned',
  });
});

/**
 * @desc    Delete a reader account
 * @route   DELETE /api/admin/readers/:id
 */
exports.deleteReader = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user || user.role !== 'reader') {
    return res.status(404).json({ success: false, message: 'Reader not found' });
  }

  await user.deleteOne();

  res.json({
    success: true,
    message: 'Reader account deleted',
  });
});
