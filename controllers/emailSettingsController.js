const EmailSettings = require('../models/EmailSettings');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  resolveConfig,
  resetSmtpTransporter,
  sendTestEmail,
  isEmailConfigured,
} = require('../utils/emailService');

function toPublic(doc, resolved) {
  return {
    enabled: doc?.enabled !== false,
    sendInDevelopment: Boolean(doc?.sendInDevelopment),
    provider: doc?.provider || resolved.provider || 'smtp',
    smtpHost: doc?.smtpHost || '',
    smtpPort: doc?.smtpPort || 465,
    smtpSecure: doc?.smtpSecure !== false,
    smtpUser: doc?.smtpUser || '',
    hasSmtpPassword: Boolean(doc?.smtpPassword),
    hasSendgridApiKey: Boolean(doc?.sendgridApiKey),
    fromEmail: doc?.fromEmail || '',
    fromName: doc?.fromName || 'Bloomwik',
    replyTo: doc?.replyTo || '',
    clientUrl: doc?.clientUrl || '',
    verificationExpiryHours: doc?.verificationExpiryHours || 24,
    /** Effective runtime status (DB overrides + env). */
    runtime: {
      configured: Boolean(resolved && (resolved.smtpHost || resolved.sendgridApiKey)),
      provider: resolved?.provider,
      smtpHost: resolved?.smtpHost || '',
      smtpPort: resolved?.smtpPort,
      fromEmail: resolved?.fromEmail,
      clientUrl: resolved?.clientUrl,
      envFallback: !doc?.smtpHost && Boolean(resolved?.smtpHost),
    },
  };
}

async function getOrCreate() {
  let doc = await EmailSettings.findOne().select('+smtpPassword +sendgridApiKey');
  if (!doc) {
    doc = await EmailSettings.create({});
  }
  return doc;
}

/**
 * @route GET /api/admin/email-settings
 */
exports.getEmailSettings = asyncHandler(async (req, res) => {
  const doc = await getOrCreate();
  const resolved = await resolveConfig();
  res.json({
    success: true,
    data: toPublic(doc, resolved),
  });
});

/**
 * @route PATCH /api/admin/email-settings
 */
exports.updateEmailSettings = asyncHandler(async (req, res) => {
  const doc = await getOrCreate();
  const body = req.body || {};

  const fields = [
    'enabled',
    'sendInDevelopment',
    'provider',
    'smtpHost',
    'smtpPort',
    'smtpSecure',
    'smtpUser',
    'fromEmail',
    'fromName',
    'replyTo',
    'clientUrl',
    'verificationExpiryHours',
  ];
  fields.forEach((key) => {
    if (body[key] !== undefined) doc[key] = body[key];
  });

  if (body.smtpPassword !== undefined && String(body.smtpPassword).trim() !== '') {
    doc.smtpPassword = String(body.smtpPassword).trim();
  }
  if (body.sendgridApiKey !== undefined && String(body.sendgridApiKey).trim() !== '') {
    doc.sendgridApiKey = String(body.sendgridApiKey).trim();
  }
  if (body.clearSmtpPassword === true) doc.smtpPassword = '';
  if (body.clearSendgridApiKey === true) doc.sendgridApiKey = '';

  if (doc.clientUrl) doc.clientUrl = String(doc.clientUrl).replace(/\/$/, '');

  await doc.save();
  resetSmtpTransporter();

  const resolved = await resolveConfig();
  res.json({
    success: true,
    data: toPublic(doc, resolved),
  });
});

/**
 * @route POST /api/admin/email-settings/test
 * Body: { to: "you@example.com" }
 */
exports.testEmailSettings = asyncHandler(async (req, res) => {
  const to = String(req.body?.to || '').trim().toLowerCase();
  if (!to || !/\S+@\S+\.\S+/.test(to)) {
    return res.status(400).json({ success: false, message: 'Valid "to" email is required' });
  }

  if (!(await isEmailConfigured())) {
    return res.status(400).json({
      success: false,
      message: 'Email is not configured. Set SMTP in admin or HOST/HPORT/USER/PASSWORD in server env.',
    });
  }

  const result = await sendTestEmail(to);
  res.json({
    success: Boolean(result.sent),
    message: result.sent
      ? `Test email sent to ${to}`
      : `Email not sent (${result.reason || 'unknown'})`,
    data: result,
  });
});
