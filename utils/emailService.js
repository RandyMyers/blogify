/**
 * Transactional email — Hostinger SMTP (nodemailer) + optional SendGrid.
 *
 * Env (dealcouponz-compatible aliases):
 *   SMTP_HOST | HOST
 *   SMTP_PORT | HPORT
 *   SMTP_SECURE | SECURE
 *   SMTP_USER | USER
 *   SMTP_PASSWORD | SMTP_PASS | PASSWORD
 *   EMAIL_FROM (defaults to SMTP user — Hostinger rejects mismatched From)
 *   EMAIL_FROM_NAME
 *   CLIENT_URL
 *   SENDGRID_API_KEY (optional alternative)
 *   EMAIL_SEND_IN_DEV=true to send while NODE_ENV !== production
 *   DISABLE_EMAIL=true to kill switch
 */
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const logger = require('./logger');

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

let smtpTransporter = null;
let smtpConfigKey = '';

function envStr(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function envBool(...keys) {
  const v = envStr(...keys);
  if (!v) return undefined;
  return v === 'true' || v === '1';
}

function envInt(fallback, ...keys) {
  const v = envStr(...keys);
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

async function loadDbOverrides() {
  try {
    const EmailSettings = require('../models/EmailSettings');
    const doc = await EmailSettings.findOne().select('+smtpPassword +sendgridApiKey').lean();
    return doc || null;
  } catch {
    return null;
  }
}

async function resolveConfig() {
  const db = await loadDbOverrides();

  const smtpHost = (db?.smtpHost || envStr('SMTP_HOST', 'HOST')).trim();
  const smtpPort = db?.smtpPort || envInt(465, 'SMTP_PORT', 'HPORT');
  const smtpSecure =
    db?.smtpSecure ?? envBool('SMTP_SECURE', 'SECURE') ?? smtpPort === 465;
  const smtpUser = (db?.smtpUser || envStr('SMTP_USER', 'USER')).trim();
  const smtpPassword = (
    db?.smtpPassword ||
    envStr('SMTP_PASSWORD', 'SMTP_PASS', 'PASSWORD')
  ).trim();
  const sendgridApiKey = (db?.sendgridApiKey || envStr('SENDGRID_API_KEY', 'SENDGRID_KEY')).trim();

  const smtpUserAsFrom = smtpUser.includes('@') ? smtpUser : '';
  const fromEmail = (
    db?.fromEmail ||
    envStr('EMAIL_FROM', 'SENDGRID_FROM_EMAIL') ||
    smtpUserAsFrom ||
    'noreply@bloomwik.com'
  ).trim();
  const fromName = (
    db?.fromName ||
    envStr('EMAIL_FROM_NAME', 'SENDGRID_FROM_NAME') ||
    'Bloomwik'
  ).trim();

  const provider =
    db?.provider ||
    (sendgridApiKey && !smtpHost ? 'sendgrid' : 'smtp');

  return {
    enabled: db?.enabled !== false && process.env.DISABLE_EMAIL !== 'true',
    sendInDevelopment:
      db?.sendInDevelopment === true || process.env.EMAIL_SEND_IN_DEV === 'true',
    provider,
    smtpHost,
    smtpPort,
    smtpSecure: Boolean(smtpSecure) || smtpPort === 465,
    smtpUser,
    smtpPassword,
    sendgridApiKey,
    fromEmail,
    fromName,
    replyTo: (db?.replyTo || envStr('EMAIL_REPLY_TO') || '').trim(),
    clientUrl: (db?.clientUrl || envStr('CLIENT_URL') || 'https://bloomwik.com').replace(
      /\/$/,
      ''
    ),
    verificationExpiryHours: db?.verificationExpiryHours || 24,
  };
}

function formatFrom(config) {
  if (config.fromName && config.fromEmail) {
    return `${config.fromName} <${config.fromEmail}>`;
  }
  return config.fromEmail;
}

function getSmtpTransporter(config) {
  const passHash = crypto
    .createHash('sha1')
    .update(config.smtpPassword || '')
    .digest('hex')
    .slice(0, 8);
  const key = `${config.smtpHost}:${config.smtpPort}:${config.smtpUser}:${config.smtpSecure}:${passHash}`;
  if (smtpTransporter && smtpConfigKey === key) return smtpTransporter;
  if (!config.smtpHost) return null;

  smtpTransporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth:
      config.smtpUser && config.smtpPassword
        ? { user: config.smtpUser, pass: config.smtpPassword }
        : undefined,
  });
  smtpConfigKey = key;
  return smtpTransporter;
}

function resetSmtpTransporter() {
  smtpTransporter = null;
  smtpConfigKey = '';
}

async function isEmailConfigured() {
  const config = await resolveConfig();
  if (!config.enabled) return false;
  if (config.provider === 'sendgrid' && config.sendgridApiKey) return true;
  return Boolean(config.smtpHost && config.smtpUser && config.smtpPassword);
}

async function sendViaSendGrid(config, { to, subject, html, text }) {
  const response = await fetch(SENDGRID_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.sendgridApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: config.fromEmail, name: config.fromName },
      subject,
      content: [
        { type: 'text/plain', value: text || html?.replace(/<[^>]*>/g, ' ') || subject },
        { type: 'text/html', value: html || `<p>${text || subject}</p>` },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SendGrid error ${response.status}: ${body}`);
  }
  return true;
}

/**
 * @param {object} opts
 * @param {boolean} [opts.force] - send even in development
 */
async function sendEmail({ to, subject, html, text, force = false }) {
  if (!to) return { sent: false, reason: 'no_recipient' };

  const config = await resolveConfig();

  if (!config.enabled) {
    logger.warn('[email] disabled — skipping', { to, subject });
    return { sent: false, reason: 'disabled' };
  }

  if (!force && process.env.NODE_ENV !== 'production' && !config.sendInDevelopment) {
    logger.info('[email] (dev skip — set EMAIL_SEND_IN_DEV=true to send)', {
      to,
      subject,
      text: text || html?.slice(0, 200),
    });
    return { sent: false, reason: 'dev_skipped', dev: true };
  }

  try {
    if (config.provider === 'sendgrid' && config.sendgridApiKey) {
      await sendViaSendGrid(config, { to, subject, html, text });
      logger.info('[email] sent via SendGrid', { to, subject });
      return { sent: true, provider: 'sendgrid' };
    }

    const transport = getSmtpTransporter(config);
    if (!transport) {
      logger.warn('[email] SMTP not configured — skipping', { to, subject });
      return { sent: false, reason: 'not_configured' };
    }

    if (
      config.smtpUser.includes('@') &&
      config.fromEmail.toLowerCase() !== config.smtpUser.toLowerCase()
    ) {
      logger.warn(
        `[email] From (${config.fromEmail}) differs from SMTP user (${config.smtpUser}) — Hostinger may reject`
      );
    }

    const info = await transport.sendMail({
      from: formatFrom(config),
      to,
      subject,
      html,
      text: text || String(html || '').replace(/<[^>]*>/g, ' '),
      replyTo: config.replyTo || undefined,
    });

    logger.info('[email] sent via SMTP', {
      to,
      subject,
      messageId: info.messageId,
      host: config.smtpHost,
    });
    return { sent: true, provider: 'smtp', messageId: info.messageId };
  } catch (err) {
    logger.error('[email] send failed', { to, subject, error: err.message });
    throw err;
  }
}

function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function brandButton(url, label) {
  return `
    <div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="background:#0f766e;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">
        ${label}
      </a>
    </div>
  `;
}

async function sendReaderVerificationEmail(user, rawToken) {
  const config = await resolveConfig();
  const verifyUrl = `${config.clientUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
  const hours = config.verificationExpiryHours || 24;
  const name = user.username || 'there';
  const subject = 'Verify your Bloomwik account';
  const text = `Hi ${name},\n\nPlease verify your email by opening this link:\n${verifyUrl}\n\nThis link expires in ${hours} hours.\n\nIf you did not create an account, you can ignore this email.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
      <h2 style="color:#0f766e;">Verify your Bloomwik account</h2>
      <p>Hi ${name},</p>
      <p>Thanks for signing up. Please confirm your email address to finish setting up your account.</p>
      ${brandButton(verifyUrl, 'Verify my email')}
      <p style="font-size:13px;color:#666;">Or copy this link:<br/><span style="word-break:break-all;">${verifyUrl}</span></p>
      <p style="font-size:13px;color:#666;">This link expires in ${hours} hours. If you did not create an account, ignore this email.</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject, html, text, force: true });
}

async function sendReaderPasswordResetEmail(user, rawToken) {
  const config = await resolveConfig();
  const resetUrl = `${config.clientUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const name = user.username || 'there';
  const subject = 'Reset your Bloomwik password';
  const text = `Hi ${name},\n\nReset your password using this link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, ignore this email.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
      <h2 style="color:#0f766e;">Reset your password</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your Bloomwik password.</p>
      ${brandButton(resetUrl, 'Reset my password')}
      <p style="font-size:13px;color:#666;">Or copy this link:<br/><span style="word-break:break-all;">${resetUrl}</span></p>
      <p style="font-size:13px;color:#666;">This link expires in 1 hour. If you did not request this, ignore this email.</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject, html, text, force: true });
}

async function sendNewsletterConfirmationEmail(subscription) {
  const config = await resolveConfig();
  const confirmUrl = `${config.clientUrl}/confirm-subscription?token=${encodeURIComponent(subscription.token)}`;
  const unsubscribeUrl = `${config.clientUrl}/unsubscribe?token=${encodeURIComponent(subscription.token)}`;
  const subject = 'Confirm your Bloomwik newsletter subscription';
  const text = `Thanks for subscribing to Bloomwik!\n\nConfirm your subscription:\n${confirmUrl}\n\nIf you did not subscribe, ignore this email.\n\nTo unsubscribe later:\n${unsubscribeUrl}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;">
      <h2 style="color:#0f766e;">Confirm your subscription</h2>
      <p>Thanks for subscribing to the Bloomwik newsletter!</p>
      <p>Please confirm your email address to start receiving our latest articles.</p>
      ${brandButton(confirmUrl, 'Confirm my subscription')}
      <p style="font-size:12px;color:#666;margin-top:24px;">To unsubscribe: <a href="${unsubscribeUrl}">${unsubscribeUrl}</a></p>
    </div>
  `;
  const result = await sendEmail({ to: subscription.email, subject, html, text, force: true });
  if (result.sent) {
    subscription.lastEmailSent = new Date();
    await subscription.save();
  }
  return result;
}

async function sendTestEmail(to) {
  const config = await resolveConfig();
  return sendEmail({
    to,
    subject: 'Bloomwik SMTP test',
    text: `This is a test email from Bloomwik.\nSMTP host: ${config.smtpHost || 'n/a'}\nFrom: ${config.fromEmail}`,
    html: `<p>This is a test email from <strong>Bloomwik</strong>.</p><p>SMTP host: ${config.smtpHost || 'n/a'}<br/>From: ${config.fromEmail}</p>`,
    force: true,
  });
}

module.exports = {
  sendEmail,
  isEmailConfigured,
  resolveConfig,
  resetSmtpTransporter,
  generateSecureToken,
  hashToken,
  sendReaderVerificationEmail,
  sendReaderPasswordResetEmail,
  sendNewsletterConfirmationEmail,
  sendTestEmail,
};
