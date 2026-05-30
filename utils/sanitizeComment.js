const crypto = require('crypto');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function stripHtml(value = '') {
  return String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function sanitizeCommentBody(body) {
  const cleaned = stripHtml(body);
  if (!cleaned) return '';
  return cleaned.slice(0, 2000);
}

function sanitizeAuthorName(name) {
  return stripHtml(name).slice(0, 80);
}

function sanitizeEmail(email) {
  return String(email || '').trim().toLowerCase().slice(0, 120);
}

function sanitizeWebsite(url) {
  const trimmed = String(url || '').trim().slice(0, 300);
  if (!trimmed) return '';
  if (/^\s*javascript:/i.test(trimmed)) return '';
  return trimmed;
}

function isValidEmail(email) {
  return EMAIL_RE.test(email);
}

function hashIp(ip) {
  const salt = process.env.JWT_SECRET || 'bloomwik-comment-salt';
  return crypto.createHash('sha256').update(`${ip || 'unknown'}:${salt}`).digest('hex');
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  if (req.ip) return req.ip.replace('::ffff:', '');
  return req.connection?.remoteAddress || 'unknown';
}

function toPublicComment(doc) {
  if (!doc) return null;
  const c = doc.toObject ? doc.toObject() : { ...doc };
  return {
    _id: c._id,
    articleId: c.articleId,
    authorName: c.authorName,
    authorWebsite: c.authorWebsite || '',
    body: c.body,
    language: c.language,
    createdAt: c.createdAt,
    parentId: c.parentId || null,
    replies: c.replies || [],
  };
}

module.exports = {
  stripHtml,
  sanitizeCommentBody,
  sanitizeAuthorName,
  sanitizeEmail,
  sanitizeWebsite,
  isValidEmail,
  hashIp,
  getClientIp,
  toPublicComment,
};
