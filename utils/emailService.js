const crypto = require('crypto');
const logger = require('./logger');

const CLIENT_URL = (process.env.CLIENT_URL || 'https://bloomwik.com').replace(/\/$/, '');
const FROM_EMAIL = process.env.EMAIL_FROM || process.env.SENDGRID_FROM_EMAIL || 'noreply@bloomwik.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME || process.env.SENDGRID_FROM_NAME || 'Bloomwik';
const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

function getSendGridApiKey() {
  return process.env.SENDGRID_API_KEY || process.env.SENDGRID_KEY || '';
}

function isEmailConfigured() {
  return Boolean(getSendGridApiKey() && FROM_EMAIL);
}

async function sendViaSendGrid({ to, subject, html, text }) {
  const apiKey = getSendGridApiKey();
  if (!apiKey) return false;

  const response = await fetch(SENDGRID_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
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
 * Send an email via SendGrid API. Without SENDGRID_API_KEY, logs the message (dev).
 */
async function sendEmail({ to, subject, html, text }) {
  if (!to) return { sent: false, dev: true };

  try {
    if (isEmailConfigured()) {
      await sendViaSendGrid({ to, subject, html, text });
      return { sent: true, provider: 'sendgrid' };
    }

    logger.info('[email] (SendGrid not configured — dev log)', {
      to,
      subject,
      text: text || html?.slice(0, 200),
    });
    if (process.env.NODE_ENV === 'production') {
      logger.warn('[email] SENDGRID_API_KEY not set in production');
    }
    return { sent: false, dev: true };
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

async function sendReaderVerificationEmail(user, rawToken) {
  const verifyUrl = `${CLIENT_URL}/verify-email?token=${encodeURIComponent(rawToken)}`;
  const subject = 'Verify your Bloomwik account';
  const text = `Hi ${user.username},\n\nPlease verify your email by opening this link:\n${verifyUrl}\n\nIf you did not create an account, you can ignore this email.`;
  const html = `
    <p>Hi ${user.username},</p>
    <p>Please verify your email to complete your Bloomwik account setup.</p>
    <p><a href="${verifyUrl}">Verify my email</a></p>
    <p>Or copy this link: ${verifyUrl}</p>
    <p>If you did not create an account, you can ignore this email.</p>
  `;
  return sendEmail({ to: user.email, subject, html, text });
}

async function sendReaderPasswordResetEmail(user, rawToken) {
  const resetUrl = `${CLIENT_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const subject = 'Reset your Bloomwik password';
  const text = `Hi ${user.username},\n\nReset your password using this link (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, ignore this email.`;
  const html = `
    <p>Hi ${user.username},</p>
    <p>We received a request to reset your password.</p>
    <p><a href="${resetUrl}">Reset my password</a></p>
    <p>Or copy this link: ${resetUrl}</p>
    <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
  `;
  return sendEmail({ to: user.email, subject, html, text });
}

module.exports = {
  sendEmail,
  isEmailConfigured,
  generateSecureToken,
  hashToken,
  sendReaderVerificationEmail,
  sendReaderPasswordResetEmail,
};
