const NewsletterSubscription = require('../models/NewsletterSubscription');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @desc    Subscribe to newsletter
 * @route   POST /api/newsletter/subscribe
 * @access  Public
 */
exports.subscribe = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required'
    });
  }
  
  // Check if already subscribed
  let subscription = await NewsletterSubscription.findOne({ email });
  
  if (subscription) {
    if (subscription.confirmed && !subscription.unsubscribed) {
      return res.status(400).json({
        success: false,
        message: 'Email is already subscribed'
      });
    }
    
    // If unsubscribed, resubscribe
    if (subscription.unsubscribed) {
      subscription.unsubscribed = false;
      subscription.unsubscribedAt = null;
      subscription.token = NewsletterSubscription.generateToken();
      subscription.confirmed = false;
      subscription.confirmedAt = null;
      await subscription.save();
    }
  } else {
    // Create new subscription
    subscription = await NewsletterSubscription.create({ email });
  }
  
  // In production, send confirmation email here
  // For now, we'll return the token for testing
  // In production, the token should be sent via email
  
  res.status(201).json({
    success: true,
    message: 'Subscription request received. Please check your email to confirm.',
    data: {
      token: subscription.token, // Remove in production, only for testing
      email: subscription.email
    }
  });
});

/**
 * @desc    Confirm newsletter subscription
 * @route   GET /api/newsletter/confirm/:token
 * @access  Public
 */
exports.confirmSubscription = asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  const subscription = await NewsletterSubscription.findByToken(token);
  
  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Invalid or expired confirmation token'
    });
  }
  
  if (subscription.confirmed) {
    return res.status(400).json({
      success: false,
      message: 'Subscription already confirmed'
    });
  }
  
  await subscription.confirm();
  
  res.json({
    success: true,
    message: 'Subscription confirmed successfully'
  });
});

/**
 * @desc    Unsubscribe from newsletter
 * @route   GET /api/newsletter/unsubscribe/:token
 * @access  Public
 */
exports.unsubscribe = asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  const subscription = await NewsletterSubscription.findByToken(token);
  
  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Invalid or expired unsubscribe token'
    });
  }
  
  if (subscription.unsubscribed) {
    return res.status(400).json({
      success: false,
      message: 'Already unsubscribed'
    });
  }
  
  await subscription.unsubscribe();
  
  res.json({
    success: true,
    message: 'Successfully unsubscribed from newsletter'
  });
});

/**
 * @desc    Get all subscribers (Admin)
 * @route   GET /api/newsletter/subscribers
 * @access  Private/Admin
 */
exports.getSubscribers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;
  
  const confirmed = req.query.confirmed;
  const query = {};
  
  if (confirmed === 'true') {
    query.confirmed = true;
  } else if (confirmed === 'false') {
    query.confirmed = false;
  }
  
  const subscribers = await NewsletterSubscription.find(query)
    .sort({ subscribedAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('-token'); // Don't send tokens
  
  const total = await NewsletterSubscription.countDocuments(query);
  
  res.json({
    success: true,
    count: subscribers.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: subscribers
  });
});

/**
 * @desc    Get active subscribers count
 * @route   GET /api/newsletter/subscribers/count
 * @access  Private/Admin
 */
exports.getSubscribersCount = asyncHandler(async (req, res) => {
  const activeCount = await NewsletterSubscription.countDocuments({
    confirmed: true,
    unsubscribed: false
  });
  
  const totalCount = await NewsletterSubscription.countDocuments();
  const unconfirmedCount = await NewsletterSubscription.countDocuments({
    confirmed: false
  });
  
  res.json({
    success: true,
    data: {
      active: activeCount,
      total: totalCount,
      unconfirmed: unconfirmedCount
    }
  });
});


