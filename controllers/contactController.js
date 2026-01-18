const ContactMessage = require('../models/ContactMessage');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @desc    Create new contact message
 * @route   POST /api/contact
 * @access  Public
 */
exports.createMessage = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;
  
  if (!name || !email || !subject || !message) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }
  
  const contactMessage = await ContactMessage.create({
    name,
    email,
    subject,
    message
  });
  
  // In production, send notification email here
  
  res.status(201).json({
    success: true,
    message: 'Message sent successfully. We will get back to you soon.',
    data: contactMessage
  });
});

/**
 * @desc    Get all contact messages
 * @route   GET /api/contact
 * @access  Private/Admin
 */
exports.getAllMessages = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  const read = req.query.read;
  const replied = req.query.replied;
  
  const query = {};
  if (read === 'true') query.read = true;
  else if (read === 'false') query.read = false;
  
  if (replied === 'true') query.replied = true;
  else if (replied === 'false') query.replied = false;
  
  const messages = await ContactMessage.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  const total = await ContactMessage.countDocuments(query);
  
  res.json({
    success: true,
    count: messages.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: messages
  });
});

/**
 * @desc    Get single contact message
 * @route   GET /api/contact/:id
 * @access  Private/Admin
 */
exports.getMessage = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findById(req.params.id);
  
  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found'
    });
  }
  
  // Mark as read if not already read
  if (!message.read) {
    await message.markAsRead();
  }
  
  res.json({
    success: true,
    data: message
  });
});

/**
 * @desc    Mark message as read
 * @route   PUT /api/contact/:id/read
 * @access  Private/Admin
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findById(req.params.id);
  
  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found'
    });
  }
  
  await message.markAsRead();
  
  res.json({
    success: true,
    message: 'Message marked as read',
    data: message
  });
});

/**
 * @desc    Mark message as replied
 * @route   PUT /api/contact/:id/replied
 * @access  Private/Admin
 */
exports.markAsReplied = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findById(req.params.id);
  
  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found'
    });
  }
  
  await message.markAsReplied();
  
  res.json({
    success: true,
    message: 'Message marked as replied',
    data: message
  });
});

/**
 * @desc    Delete contact message
 * @route   DELETE /api/contact/:id
 * @access  Private/Admin
 */
exports.deleteMessage = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findById(req.params.id);
  
  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found'
    });
  }
  
  await message.deleteOne();
  
  res.json({
    success: true,
    message: 'Message deleted successfully'
  });
});

/**
 * @desc    Get unread messages count
 * @route   GET /api/contact/unread/count
 * @access  Private/Admin
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await ContactMessage.countDocuments({ read: false });
  const unrepliedCount = await ContactMessage.countDocuments({ replied: false });
  
  res.json({
    success: true,
    data: {
      unread: unreadCount,
      unreplied: unrepliedCount
    }
  });
});


