const User = require('../models/users');
const Comment = require('../models/Comment');
const { asyncHandler } = require('../middleware/errorHandler');
const { generateToken } = require('./authController');
const { toPublicComment, sanitizeCommentBody } = require('../utils/sanitizeComment');
const { syncCommentCount } = require('../utils/commentCount');

const {
  generateSecureToken,
  hashToken,
  sendReaderVerificationEmail,
  sendReaderPasswordResetEmail,
  isEmailConfigured,
} = require('../utils/emailService');

const formatReader = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  profile: user.profile,
  emailVerified: Boolean(user.emailVerified),
});

async function issueVerificationToken(user) {
  const rawToken = generateSecureToken();
  user.emailVerificationToken = hashToken(rawToken);
  await user.save();
  try {
    await sendReaderVerificationEmail(user, rawToken);
  } catch {
    /* registration still succeeds; user can resend from account */
  }
  return rawToken;
}

async function resolveUniqueUsername(displayName) {
  const cleaned = String(displayName || '')
    .trim()
    .slice(0, 50)
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();
  const base = cleaned || 'reader';
  let username = base;
  let suffix = 0;
  while (await User.findOne({ username })) {
    suffix += 1;
    username = `${base}${suffix}`;
  }
  return username;
}

/**
 * @desc    Register a reader account
 * @route   POST /api/auth/reader/register
 */
exports.registerReader = asyncHandler(async (req, res) => {
  const displayName = String(req.body.displayName || req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = req.body.password;

  if (!displayName || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Display name, email, and password are required',
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters',
    });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: 'An account with this email already exists',
    });
  }

  const username = await resolveUniqueUsername(displayName);

  const user = await User.create({
    username,
    email,
    password,
    role: 'reader',
    emailVerified: false,
  });

  await issueVerificationToken(user);

  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    token,
    user: formatReader(user),
    message: isEmailConfigured()
      ? 'Account created. Please check your email to verify your address.'
      : 'Account created. Verify your email from your account page when email is configured.',
  });
});

/**
 * @desc    Reader login
 * @route   POST /api/auth/reader/login
 */
exports.loginReader = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide email and password',
    });
  }

  const user = await User.findOne({ email });

  if (!user || user.role !== 'reader') {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  if (user.isBanned) {
    return res.status(403).json({
      success: false,
      message: 'Your account has been suspended. Contact support if you believe this is an error.',
      code: 'ACCOUNT_BANNED',
    });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  user.lastLogin = new Date();
  await user.save();

  const token = generateToken(user._id);

  res.json({
    success: true,
    token,
    user: formatReader(user),
  });
});

/**
 * @desc    Get current reader profile
 * @route   GET /api/auth/reader/me
 */
exports.getReaderMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: formatReader(req.user),
  });
});

/**
 * @desc    List comments by the authenticated reader
 * @route   GET /api/auth/reader/comments
 */
exports.getReaderComments = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const skip = (page - 1) * limit;
  const status = req.query.status;

  const query = { userId: req.user._id };
  if (status && status !== 'all') {
    query.status = status;
  }

  const [comments, total] = await Promise.all([
    Comment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('articleId', 'title baseSlug translations defaultLanguage'),
    Comment.countDocuments(query),
  ]);

  res.json({
    success: true,
    count: comments.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    data: comments.map((c) => {
      const article = c.articleId && typeof c.articleId === 'object' ? c.articleId : null;
      const lang = c.language || article?.defaultLanguage || 'en';
      const articleTitle =
        article?.translations?.[lang]?.title ||
        article?.title ||
        article?.baseSlug ||
        c.articleSlug ||
        '';
      return {
        ...toPublicComment(c),
        status: c.status,
        articleSlug: c.articleSlug,
        articleTitle,
        articleId: article?._id || c.articleId,
      };
    }),
  });
});

/**
 * @desc    Update own pending comment
 * @route   PATCH /api/auth/reader/comments/:id
 */
exports.updateReaderComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findOne({
    _id: req.params.id,
    userId: req.user._id,
    status: 'pending',
  });

  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'Comment not found or cannot be edited',
    });
  }

  const cleaned = sanitizeCommentBody(req.body.body);
  if (!cleaned) {
    return res.status(400).json({ success: false, message: 'Comment body cannot be empty' });
  }

  comment.body = cleaned;
  await comment.save();

  res.json({
    success: true,
    data: {
      ...toPublicComment(comment),
      status: comment.status,
      articleSlug: comment.articleSlug,
    },
  });
});

/**
 * @desc    Delete own pending comment (and pending replies)
 * @route   DELETE /api/auth/reader/comments/:id
 */
exports.deleteReaderComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findOne({
    _id: req.params.id,
    userId: req.user._id,
    status: 'pending',
  });

  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'Comment not found or cannot be deleted',
    });
  }

  await Comment.deleteMany({
    $or: [{ _id: comment._id }, { parentId: comment._id, status: 'pending', userId: req.user._id }],
  });

  res.json({ success: true, message: 'Comment deleted' });
});

/**
 * @desc    Verify reader email address
 * @route   POST /api/auth/reader/verify-email
 */
exports.verifyReaderEmail = asyncHandler(async (req, res) => {
  const rawToken = String(req.body.token || req.query.token || '').trim();
  if (!rawToken) {
    return res.status(400).json({ success: false, message: 'Verification token is required' });
  }

  const user = await User.findOne({
    emailVerificationToken: hashToken(rawToken),
    role: 'reader',
  });

  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid or expired verification link' });
  }

  user.emailVerified = true;
  user.emailVerificationToken = null;
  await user.save();

  res.json({
    success: true,
    message: 'Email verified successfully',
    user: formatReader(user),
  });
});

/**
 * @desc    Resend verification email
 * @route   POST /api/auth/reader/resend-verification
 */
exports.resendReaderVerification = asyncHandler(async (req, res) => {
  const user = req.user;

  if (user.emailVerified) {
    return res.json({ success: true, message: 'Email is already verified' });
  }

  await issueVerificationToken(user);

  res.json({
    success: true,
    message: isEmailConfigured()
      ? 'Verification email sent. Please check your inbox.'
      : 'Verification email queued (check server logs if email is not configured).',
  });
});

/**
 * @desc    Request password reset email
 * @route   POST /api/auth/reader/forgot-password
 */
exports.forgotReaderPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const genericMessage =
    'If an account exists for that email, you will receive a password reset link shortly.';

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const user = await User.findOne({ email, role: 'reader' });

  if (user) {
    const rawToken = generateSecureToken();
    user.passwordResetToken = hashToken(rawToken);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    try {
      await sendReaderPasswordResetEmail(user, rawToken);
    } catch {
      /* still return generic success to avoid leaking account existence */
    }
  }

  res.json({ success: true, message: genericMessage });
});

/**
 * @desc    Reset password with token
 * @route   POST /api/auth/reader/reset-password
 */
exports.resetReaderPassword = asyncHandler(async (req, res) => {
  const rawToken = String(req.body.token || '').trim();
  const password = req.body.password;

  if (!rawToken || !password) {
    return res.status(400).json({
      success: false,
      message: 'Token and new password are required',
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters',
    });
  }

  const user = await User.findOne({
    passwordResetToken: hashToken(rawToken),
    passwordResetExpires: { $gt: new Date() },
    role: 'reader',
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired reset link. Please request a new one.',
    });
  }

  user.password = password;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();

  res.json({
    success: true,
    message: 'Password updated. You can sign in with your new password.',
  });
});
