const NewsletterSubscription = require('../models/NewsletterSubscription');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendNewsletterConfirmationEmail } = require('../utils/emailService');
const logger = require('../utils/logger');

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
      message: 'Email is required',
    });
  }

  let subscription = await NewsletterSubscription.findOne({ email });
  let isResend = false;

  if (subscription) {
    if (subscription.confirmed && !subscription.unsubscribed) {
      return res.status(400).json({
        success: false,
        message: 'This email is already subscribed to our newsletter.',
      });
    }

    if (subscription.unsubscribed) {
      subscription.unsubscribed = false;
      subscription.unsubscribedAt = null;
      subscription.token = NewsletterSubscription.generateToken();
      subscription.confirmed = false;
      subscription.confirmedAt = null;
      await subscription.save();
    } else if (!subscription.confirmed) {
      isResend = true;
    }
  } else {
    subscription = await NewsletterSubscription.create({ email });
  }

  try {
    await sendNewsletterConfirmationEmail(subscription);
  } catch (err) {
    logger.warn('[newsletter] confirmation email failed', { email, error: err.message });
  }

  const message = isResend
    ? 'We sent another confirmation email. Please check your inbox.'
    : 'Thank you for subscribing! Please check your email to confirm your subscription.';

  res.status(201).json({
    success: true,
    message,
  });
});

/**
 * @desc    Confirm newsletter subscription
 * @route   GET /api/newsletter/confirm/:token
 * @access  Public
 */
exports.confirmSubscription = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const subscription = await NewsletterSubscription.findOne({ token });

  if (!subscription || subscription.unsubscribed) {
    return res.status(404).json({
      success: false,
      message: 'Invalid or expired confirmation token',
    });
  }

  if (subscription.confirmed) {
    return res.status(400).json({
      success: false,
      message: 'Your subscription was already confirmed',
    });
  }

  await subscription.confirm();

  res.json({
    success: true,
    message: 'Your subscription has been confirmed! You will now receive our latest articles and updates.',
  });
});

/**
 * @desc    Unsubscribe from newsletter
 * @route   GET /api/newsletter/unsubscribe/:token
 * @access  Public
 */
exports.unsubscribe = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const subscription = await NewsletterSubscription.findOne({ token });

  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Invalid or expired unsubscribe link',
    });
  }

  if (subscription.unsubscribed) {
    return res.json({
      success: true,
      message: 'You are already unsubscribed from our newsletter.',
    });
  }

  await subscription.unsubscribe();

  res.json({
    success: true,
    message: 'You have been successfully unsubscribed from our newsletter.',
  });
});

function buildSubscriberQuery(queryParams = {}) {
  const { confirmed, status, search } = queryParams;
  const query = {};

  if (status === 'unsubscribed') {
    query.unsubscribed = true;
  } else if (confirmed === 'true') {
    query.confirmed = true;
    query.unsubscribed = false;
  } else if (confirmed === 'false') {
    query.confirmed = false;
    query.unsubscribed = false;
  }

  const term = String(search || '').trim();
  if (term) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.email = new RegExp(escaped, 'i');
  }

  return query;
}

function subscriberStatus(subscriber) {
  if (subscriber.unsubscribed) return 'unsubscribed';
  if (subscriber.confirmed) return 'confirmed';
  return 'pending';
}

function csvEscape(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/**
 * @desc    Get all subscribers (Admin)
 * @route   GET /api/newsletter/subscribers
 * @access  Private/Admin
 */
exports.getSubscribers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const skip = (page - 1) * limit;

  const query = buildSubscriberQuery(req.query);

  const subscribers = await NewsletterSubscription.find(query)
    .sort({ subscribedAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('-token')
    .lean();

  const total = await NewsletterSubscription.countDocuments(query);

  res.json({
    success: true,
    count: subscribers.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    data: subscribers.map((s) => ({
      ...s,
      status: subscriberStatus(s),
    })),
  });
});

/**
 * @desc    Export subscribers as CSV (Admin)
 * @route   GET /api/newsletter/subscribers/export
 * @access  Private/Admin
 */
exports.exportSubscribers = asyncHandler(async (req, res) => {
  const query = buildSubscriberQuery(req.query);

  const subscribers = await NewsletterSubscription.find(query)
    .sort({ subscribedAt: -1 })
    .select('-token')
    .lean();

  const lines = [
    'email,status,subscribed_at,confirmed_at,unsubscribed_at',
    ...subscribers.map((s) =>
      [
        csvEscape(s.email),
        csvEscape(subscriberStatus(s)),
        csvEscape(s.subscribedAt ? new Date(s.subscribedAt).toISOString() : ''),
        csvEscape(s.confirmedAt ? new Date(s.confirmedAt).toISOString() : ''),
        csvEscape(s.unsubscribedAt ? new Date(s.unsubscribedAt).toISOString() : ''),
      ].join(',')
    ),
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bloomwik-subscribers.csv"');
  res.send(lines.join('\n'));
});

/**
 * @desc    Get active subscribers count
 * @route   GET /api/newsletter/subscribers/count
 * @access  Private/Admin
 */
exports.getSubscribersCount = asyncHandler(async (req, res) => {
  const activeCount = await NewsletterSubscription.countDocuments({
    confirmed: true,
    unsubscribed: false,
  });

  const totalCount = await NewsletterSubscription.countDocuments();
  const unconfirmedCount = await NewsletterSubscription.countDocuments({
    confirmed: false,
    unsubscribed: false,
  });

  res.json({
    success: true,
    data: {
      active: activeCount,
      total: totalCount,
      unconfirmed: unconfirmedCount,
    },
  });
});
