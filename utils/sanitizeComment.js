const crypto = require('crypto');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function stripHtml(value = '') {
  return String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

const URL_RE = /https?:\/\/[^\s<]+[^\s<.,;:!?)'\]"»]/gi;
const UGC_REL = 'nofollow ugc noopener noreferrer';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function linkifyPlainText(text = '') {
  const escaped = escapeHtml(text);
  return escaped.replace(URL_RE, (url) => {
    const href = escapeHtml(url);
    return `<a href="${href}" rel="${UGC_REL}" target="_blank">${href}</a>`;
  });
}

function formatCommentBodyForDisplay(body = '') {
  const plain = stripHtml(body).slice(0, 2000);
  if (!plain) return '';
  return linkifyPlainText(plain);
}

function normalizeCommentUrl(url = '') {
  const trimmed = String(url).trim();
  if (!trimmed || /^javascript:/i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function extractUrlsFromCommentBody(body = '') {
  const urls = new Set();
  const text = String(body);

  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  let match = hrefRe.exec(text);
  while (match) {
    const normalized = normalizeCommentUrl(match[1]);
    if (normalized) urls.add(normalized);
    match = hrefRe.exec(text);
  }

  const plain = text.replace(/<[^>]*>/g, ' ');
  URL_RE.lastIndex = 0;
  match = URL_RE.exec(plain);
  while (match) {
    const normalized = normalizeCommentUrl(match[0]);
    if (normalized) urls.add(normalized);
    match = URL_RE.exec(plain);
  }

  return [...urls];
}

function sanitizeCommentBody(body) {
  const cleaned = stripHtml(body);
  if (!cleaned) return '';
  return linkifyPlainText(cleaned.slice(0, 2000));
}

function sanitizeAuthorName(name) {
  return stripHtml(name).slice(0, 80);
}

function sanitizeEmail(email) {
  return String(email || '').trim().toLowerCase().slice(0, 120);
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
    isRegistered: Boolean(c.userId),
    body: formatCommentBodyForDisplay(c.body),
    language: c.language,
    createdAt: c.createdAt,
    parentId: c.parentId || null,
    replies: c.replies || [],
  };
}

module.exports = {
  stripHtml,
  sanitizeCommentBody,
  formatCommentBodyForDisplay,
  extractUrlsFromCommentBody,
  normalizeCommentUrl,
  sanitizeAuthorName,
  sanitizeEmail,
  isValidEmail,
  hashIp,
  getClientIp,
  toPublicComment,
};
