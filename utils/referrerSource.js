/**
 * Normalize HTTP referrer URLs into readable traffic sources for analytics.
 */

function parseHostname(referrer) {
  if (!referrer || typeof referrer !== 'string') return null;
  const trimmed = referrer.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return new URL(trimmed).hostname.replace(/^www\./i, '').toLowerCase();
    }
    return trimmed.replace(/^www\./i, '').split('/')[0].toLowerCase();
  } catch {
    return trimmed.replace(/^www\./i, '').split('/')[0].toLowerCase();
  }
}

const HOST_LABELS = [
  [/google\./i, 'Google'],
  [/bing\.com/i, 'Bing'],
  [/yahoo\./i, 'Yahoo'],
  [/duckduckgo\./i, 'DuckDuckGo'],
  [/facebook\.com|fb\.com|m\.facebook/i, 'Facebook'],
  [/instagram\.com/i, 'Instagram'],
  [/twitter\.com|t\.co|x\.com/i, 'X (Twitter)'],
  [/linkedin\.com/i, 'LinkedIn'],
  [/pinterest\./i, 'Pinterest'],
  [/reddit\.com/i, 'Reddit'],
  [/youtube\.com|youtu\.be/i, 'YouTube'],
  [/tiktok\.com/i, 'TikTok'],
  [/chat\.openai\.com|chatgpt\.com/i, 'ChatGPT'],
  [/perplexity\./i, 'Perplexity'],
  [/claude\.ai|anthropic\./i, 'Claude'],
  [/gemini\.google/i, 'Gemini'],
  [/copilot\.microsoft/i, 'Microsoft Copilot'],
  [/baidu\.com/i, 'Baidu'],
  [/yandex\./i, 'Yandex'],
  [/ecosia\.org/i, 'Ecosia'],
  [/startpage\.com/i, 'Startpage'],
  [/brave\.com/i, 'Brave Search'],
  [/ask\.com/i, 'Ask'],
  [/naver\.com/i, 'Naver'],
  [/daum\.net/i, 'Daum'],
];

const SEARCH_ENGINE_SOURCES = new Set([
  'Google',
  'Bing',
  'Yahoo',
  'DuckDuckGo',
  'Baidu',
  'Yandex',
  'Ecosia',
  'Startpage',
  'Brave Search',
  'Ask',
  'Naver',
  'Daum',
]);

function isSearchEngineSource(source) {
  return SEARCH_ENGINE_SOURCES.has(source);
}

function normalizeReferrerSource(referrer) {
  const raw = referrer && String(referrer).trim() ? String(referrer).trim() : null;
  if (!raw || raw === 'Direct / none') {
    return { source: 'Direct', raw: null, isDirect: true };
  }

  const host = parseHostname(raw);
  if (!host) {
    return { source: 'Direct', raw, isDirect: true };
  }

  for (const [pattern, label] of HOST_LABELS) {
    if (pattern.test(host) || pattern.test(raw)) {
      return { source: label, raw, isDirect: false };
    }
  }

  return { source: host, raw, isDirect: false };
}

function aggregateReferrerRows(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    const raw = row.source === 'Direct / none' ? null : row.source;
    const { source } = normalizeReferrerSource(raw);
    const existing = map.get(source) || {
      source,
      views: 0,
      uniqueVisitors: 0,
    };
    existing.views += row.views || 0;
    existing.uniqueVisitors += row.uniqueVisitors || 0;
    map.set(source, existing);
  });

  return Array.from(map.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, 20);
}

module.exports = {
  normalizeReferrerSource,
  parseHostname,
  isSearchEngineSource,
  aggregateReferrerRows,
  SEARCH_ENGINE_SOURCES,
};
