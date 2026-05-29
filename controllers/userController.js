const User = require('../models/users');
const { asyncHandler } = require('../middleware/errorHandler');

function sanitizeUser(user) {
  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * @desc    List admin users
 * @route   GET /api/users
 * @access  Private/Admin
 */
exports.getUsers = asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const query = {};

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    query.$or = [{ username: regex }, { email: regex }];
  }

  const users = await User.find(query).sort({ createdAt: -1 }).select('-password -refreshToken');
  res.json({
    success: true,
    count: users.length,
    data: users.map(sanitizeUser),
  });
});

/**
 * @desc    Create admin user
 * @route   POST /api/users
 * @access  Private/Admin
 */
exports.createUser = asyncHandler(async (req, res) => {
  const { username, email, password, role = 'admin' } = req.body;

  if (!username?.trim() || !email?.trim() || !password) {
    return res.status(400).json({
      success: false,
      message: 'username, email, and password are required',
    });
  }

  const allowedRoles = ['admin', 'advertiser', 'affiliate'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role',
    });
  }

  const existing = await User.findOne({
    $or: [{ email: email.toLowerCase().trim() }, { username: username.trim() }],
  });
  if (existing) {
    return res.status(400).json({
      success: false,
      message: 'Username or email already in use',
    });
  }

  const user = await User.create({
    username: username.trim(),
    email: email.toLowerCase().trim(),
    password,
    role,
    emailVerified: true,
  });

  res.status(201).json({ success: true, data: sanitizeUser(user) });
});

/**
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const { username, email, password, role } = req.body;

  if (username !== undefined) user.username = username.trim();
  if (email !== undefined) user.email = email.toLowerCase().trim();
  if (role !== undefined) {
    const allowedRoles = ['admin', 'advertiser', 'affiliate'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    user.role = role;
  }
  if (password) user.password = password;

  if (username || email) {
    const conflict = await User.findOne({
      _id: { $ne: user._id },
      $or: [
        ...(email ? [{ email: user.email }] : []),
        ...(username ? [{ username: user.username }] : []),
      ],
    });
    if (conflict) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already in use',
      });
    }
  }

  await user.save();
  res.json({ success: true, data: sanitizeUser(user) });
});

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (req.user._id.toString() === user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'You cannot delete your own account',
    });
  }

  if (user.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the last admin user',
      });
    }
  }

  await user.deleteOne();
  res.json({ success: true, message: 'User deleted' });
});
