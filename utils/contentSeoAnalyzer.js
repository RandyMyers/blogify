/**
 * Rank Math–style content SEO analyzer (server-side, Node).
 * Logic mirrors admin/src/utils/contentSeoAnalyzer.js
 */

const CHECK_WEIGHTS = {
  focus_keyword: 5,
  keyword_title: 10,
  keyword_description: 8,
  keyword_slug: 8,
  keyword_h1: 10,
  keyword_intro: 7,
  keyword_subheading: 7,
  keyword_density: 8,
  content_length: 10,
  meta_title_length: 8,
  meta_description_length: 8,
  excerpt: 5,
  featured_image_alt: 7,
  single_h1: 5,
  internal_links: 5,
  image_alt: 5,
  readability: 4,
  faq_schema: 4,
};

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function paragraphsToHtml(paragraphs) {
  if (!Array.isArray(paragraphs)) return '';
  return paragraphs.map((p) => String(p || '')).join('');
}

function countWords(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function countSyllables(word) {
  const w = String(word || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const vowelGroups = w.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;
  if (w.endsWith('e') && count > 1) count -= 1;
  return Math.max(1, count);
}

function fleschReadingEase(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const sentences = t.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 10 || sentences.length === 0) return null;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
  return Math.round(Math.max(0, Math.min(100, score)));
}

function fleschLabel(score) {
  if (score >= 70) return 'Fairly easy';
  if (score >= 60) return 'Standard';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Difficult';
  return 'Very difficult';
}

function extractFaqCandidates(html) {
  if (!html) return [];
  const faqs = [];
  const headingRe = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;
  while ((match = headingRe.exec(html)) !== null) {
    const headingText = stripHtml(match[2]).trim();
    if (!headingText.includes('?')) continue;
    const after = html.slice(match.index + match[0].length);
    const nextHead = after.search(/<h[23][\s>]/i);
    const chunk = nextHead === -1 ? after : after.slice(0, nextHead);
    const answer = stripHtml(chunk).trim();
    if (answer.length >= 20) {
      faqs.push({ question: headingText, answer: answer.slice(0, 500) });
    }
  }
  return faqs;
}

function detectHowToHint(html) {
  if (!html) return false;
  const howToHeading = /<h[23][^>]*>[\s\S]*?how to[\s\S]*?<\/h[23]>/i.test(html);
  const steps = html.match(/<ol[^>]*>[\s\S]*?<li/gi) || [];
  return howToHeading && steps.length >= 3;
}

function suggestInternalLinks({ focusKeyword, tags, siteArticles, currentSlug, linkedSlugs, categoryName, limit = 5 }) {
  if (!Array.isArray(siteArticles) || siteArticles.length === 0) return [];

  const kw = normalizeKeyword(focusKeyword);
  const tagSet = new Set((tags || []).map((t) => String(t).toLowerCase()));
  const linked = new Set((linkedSlugs || []).map((s) => String(s).toLowerCase()));
  const current = String(currentSlug || '').toLowerCase();
  const cat = String(categoryName || '').toLowerCase();

  const scored = siteArticles
    .map((article) => {
      const slug = String(article.baseSlug || article.slug || '').toLowerCase();
      if (!slug || slug === current || linked.has(slug)) return null;

      let score = 0;
      const aTitle = String(article.title || '').toLowerCase();
      const aTags = (article.tags || []).map((t) => String(t).toLowerCase());
      const aCategory = String(article.category?.name || article.categoryName || '').toLowerCase();

      if (kw && aTitle.includes(kw)) score += 10;
      if (kw) {
        kw.split(/\s+/).filter(Boolean).forEach((w) => {
          if (aTitle.includes(w)) score += 2;
        });
      }
      aTags.forEach((t) => {
        if (tagSet.has(t)) score += 5;
      });
      if (cat && aCategory && aCategory === cat) score += 4;

      return { article, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const picks = scored.filter((s) => s.score > 0).slice(0, limit);
  const fallback = picks.length > 0 ? picks : scored.slice(0, Math.min(3, limit));

  return fallback.map(({ article, score }) => ({
    title: article.title,
    slug: article.baseSlug || article.slug,
    url: `/article/${article.baseSlug || article.slug}`,
    reason:
      score >= 10 && kw
        ? 'Matches focus keyword'
        : score >= 5
          ? 'Shares tags with this post'
          : cat
            ? 'Same category'
            : 'Related article',
  }));
}

function normalizeKeyword(keyword) {
  return String(keyword || '').trim().toLowerCase();
}

function containsKeyword(text, keyword) {
  const k = normalizeKeyword(keyword);
  if (!k || !text) return false;
  return String(text).toLowerCase().includes(k);
}

function keywordDensity(text, keyword) {
  const k = normalizeKeyword(keyword);
  if (!k) return 0;
  const words = String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 0;
  const kwWords = k.split(/\s+/).filter(Boolean);
  if (kwWords.length === 1) {
    const matches = words.filter((w) => w.includes(kwWords[0])).length;
    return (matches / words.length) * 100;
  }
  const hay = String(text || '').toLowerCase();
  const occurrences = hay.split(k).length - 1;
  return (occurrences / words.length) * 100;
}

function parseContentStats(html) {
  const h1Matches = html.match(/<h1[\s>]/gi) || [];
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const linkTags = html.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi) || [];

  let imagesWithoutAlt = 0;
  imgTags.forEach((tag) => {
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    if (!altMatch || !altMatch[1].trim()) imagesWithoutAlt += 1;
  });

  let internalLinks = 0;
  const linkedInternalSlugs = [];
  linkTags.forEach((tag) => {
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    const href = hrefMatch ? hrefMatch[1] : '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    const articleMatch = href.match(/\/article\/([^/?#]+)/i);
    if (articleMatch) linkedInternalSlugs.push(articleMatch[1].toLowerCase());
    if (href.startsWith('/') || !/^https?:\/\//i.test(href)) {
      internalLinks += 1;
    }
  });

  const subheadingText = [];
  const subMatches = html.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi) || [];
  subMatches.forEach((block) => {
    subheadingText.push(stripHtml(block));
  });

  return {
    h1Count: h1Matches.length,
    subheadingText: subheadingText.join(' '),
    imageCount: imgTags.length,
    imagesWithoutAlt,
    internalLinks,
    linkedInternalSlugs,
  };
}

function statusPoints(status) {
  if (status === 'good') return 1;
  if (status === 'warn') return 0.5;
  return 0;
}

function makeCheck(id, label, status, message, group) {
  return {
    id,
    label,
    status,
    message,
    group,
    weight: CHECK_WEIGHTS[id] || 0,
    points: statusPoints(status) * (CHECK_WEIGHTS[id] || 0),
  };
}

function scoreGrade(score) {
  if (score >= 80) return { grade: 'Excellent', color: 'success' };
  if (score >= 60) return { grade: 'Good', color: 'primary' };
  if (score >= 40) return { grade: 'Needs work', color: 'warning' };
  return { grade: 'Poor', color: 'danger' };
}

function analyzeContentSeo(input) {
  const focusKeyword = input.focusKeyword || '';
  const title = input.title || '';
  const slug = input.slug || input.baseSlug || '';
  const excerpt = input.excerpt || '';
  const metaTitle = input.metaTitle || title;
  const metaDescription = input.metaDescription || excerpt;
  const html = paragraphsToHtml(input.content);
  const plainText = stripHtml(html);
  const wordCount = countWords(plainText);
  const stats = parseContentStats(html);
  const introWords = plainText.split(/\s+/).slice(0, 100).join(' ');
  const hasKeyword = Boolean(normalizeKeyword(focusKeyword));

  const checks = [];

  checks.push(
    makeCheck(
      'focus_keyword',
      'Focus keyword',
      hasKeyword ? 'good' : 'bad',
      hasKeyword ? `Focus keyword: "${focusKeyword.trim()}"` : 'Set a focus keyword to optimize this post.',
      'basic'
    )
  );

  if (hasKeyword) {
    checks.push(
      makeCheck(
        'keyword_title',
        'Keyword in SEO title',
        containsKeyword(metaTitle, focusKeyword) ? 'good' : 'bad',
        containsKeyword(metaTitle, focusKeyword)
          ? 'Focus keyword appears in the meta title.'
          : 'Add the focus keyword to the meta title.',
        'basic'
      ),
      makeCheck(
        'keyword_description',
        'Keyword in meta description',
        containsKeyword(metaDescription, focusKeyword) ? 'good' : 'bad',
        containsKeyword(metaDescription, focusKeyword)
          ? 'Focus keyword appears in the meta description.'
          : 'Add the focus keyword to the meta description.',
        'basic'
      ),
      makeCheck(
        'keyword_slug',
        'Keyword in URL',
        containsKeyword(slug, focusKeyword) ? 'good' : slug ? 'warn' : 'bad',
        containsKeyword(slug, focusKeyword)
          ? 'Focus keyword appears in the URL slug.'
          : slug
            ? 'Consider including the focus keyword in the slug.'
            : 'Set a URL slug that includes your keyword.',
        'basic'
      ),
      makeCheck(
        'keyword_h1',
        'Keyword in title (H1)',
        containsKeyword(title, focusKeyword) ? 'good' : 'bad',
        containsKeyword(title, focusKeyword)
          ? 'Focus keyword appears in the post title.'
          : 'Use the focus keyword in the main post title.',
        'content'
      ),
      makeCheck(
        'keyword_intro',
        'Keyword in introduction',
        containsKeyword(introWords, focusKeyword) ? 'good' : 'bad',
        containsKeyword(introWords, focusKeyword)
          ? 'Focus keyword appears early in the content.'
          : 'Mention the focus keyword in the first paragraph.',
        'content'
      ),
      makeCheck(
        'keyword_subheading',
        'Keyword in subheading',
        containsKeyword(stats.subheadingText, focusKeyword) ? 'good' : 'bad',
        containsKeyword(stats.subheadingText, focusKeyword)
          ? 'Focus keyword appears in an H2 or H3.'
          : 'Add the focus keyword to at least one subheading.',
        'content'
      )
    );

    const density = keywordDensity(plainText, focusKeyword);
    let densityStatus = 'bad';
    let densityMsg = `Keyword density is ${density.toFixed(1)}% — aim for 0.5–2.5%.`;
    if (density >= 0.5 && density <= 2.5) {
      densityStatus = 'good';
      densityMsg = `Keyword density is ${density.toFixed(1)}% (good).`;
    } else if ((density >= 0.3 && density < 0.5) || (density > 2.5 && density <= 3.5)) {
      densityStatus = 'warn';
    }
    checks.push(makeCheck('keyword_density', 'Keyword density', densityStatus, densityMsg, 'content'));
  } else {
    [
      'keyword_title',
      'keyword_description',
      'keyword_slug',
      'keyword_h1',
      'keyword_intro',
      'keyword_subheading',
      'keyword_density',
    ].forEach((id) => {
      const labels = {
        keyword_title: 'Keyword in SEO title',
        keyword_description: 'Keyword in meta description',
        keyword_slug: 'Keyword in URL',
        keyword_h1: 'Keyword in title (H1)',
        keyword_intro: 'Keyword in introduction',
        keyword_subheading: 'Keyword in subheading',
        keyword_density: 'Keyword density',
      };
      checks.push(makeCheck(id, labels[id], 'neutral', 'Set a focus keyword first.', 'basic'));
    });
  }

  let lengthStatus = 'bad';
  let lengthMsg = `${wordCount} words — add more content (aim for 600+).`;
  if (wordCount >= 600) {
    lengthStatus = 'good';
    lengthMsg = `${wordCount} words — great content length.`;
  } else if (wordCount >= 300) {
    lengthStatus = 'warn';
    lengthMsg = `${wordCount} words — acceptable; 600+ is better for SEO.`;
  }
  checks.push(makeCheck('content_length', 'Content length', lengthStatus, lengthMsg, 'content'));

  const mtLen = metaTitle.length;
  let mtStatus = 'bad';
  let mtMsg = 'Add a meta title.';
  if (mtLen >= 50 && mtLen <= 60) {
    mtStatus = 'good';
    mtMsg = `Meta title is ${mtLen} characters (ideal: 50–60).`;
  } else if (mtLen > 0 && ((mtLen >= 40 && mtLen < 50) || mtLen === 61)) {
    mtStatus = 'warn';
    mtMsg = `Meta title is ${mtLen} characters — aim for 50–60.`;
  } else if (mtLen > 60) {
    mtStatus = 'bad';
    mtMsg = `Meta title is ${mtLen} characters — shorten to 60 or less.`;
  } else if (mtLen > 0) {
    mtStatus = 'warn';
    mtMsg = `Meta title is ${mtLen} characters — aim for 50–60.`;
  }
  checks.push(makeCheck('meta_title_length', 'Meta title length', mtStatus, mtMsg, 'basic'));

  const mdLen = metaDescription.length;
  let mdStatus = 'bad';
  let mdMsg = 'Add a meta description.';
  if (mdLen >= 120 && mdLen <= 160) {
    mdStatus = 'good';
    mdMsg = `Meta description is ${mdLen} characters (ideal: 120–160).`;
  } else if (mdLen > 0 && ((mdLen >= 80 && mdLen < 120) || mdLen > 160)) {
    mdStatus = 'warn';
    mdMsg = `Meta description is ${mdLen} characters — aim for 120–160.`;
  } else if (mdLen > 0) {
    mdStatus = 'warn';
    mdMsg = `Meta description is ${mdLen} characters — aim for 120–160.`;
  }
  checks.push(makeCheck('meta_description_length', 'Meta description length', mdStatus, mdMsg, 'basic'));

  const exLen = excerpt.trim().length;
  checks.push(
    makeCheck(
      'excerpt',
      'Excerpt',
      exLen >= 50 ? 'good' : exLen > 0 ? 'warn' : 'bad',
      exLen >= 50
        ? 'Excerpt is set and long enough for previews.'
        : exLen > 0
          ? 'Excerpt is short — expand to ~50+ characters.'
          : 'Add an excerpt for cards and social previews.',
      'basic'
    )
  );

  checks.push(
    makeCheck(
      'featured_image_alt',
      'Featured image alt text',
      input.imageAlt?.trim() ? 'good' : 'bad',
      input.imageAlt?.trim() ? 'Featured image has alt text.' : 'Add alt text to the featured image.',
      'media'
    )
  );

  checks.push(
    makeCheck(
      'single_h1',
      'Single H1 on page',
      stats.h1Count === 0 ? 'good' : 'bad',
      stats.h1Count === 0
        ? 'Content uses H2/H3 only — the post title is the page H1.'
        : `Remove ${stats.h1Count} H1 tag(s) from the body; use H2/H3 instead.`,
      'content'
    )
  );

  checks.push(
    makeCheck(
      'internal_links',
      'Internal links',
      stats.internalLinks >= 1 ? 'good' : 'warn',
      stats.internalLinks >= 1
        ? `${stats.internalLinks} internal link(s) found.`
        : 'Add at least one internal link to related content.',
      'links'
    )
  );

  if (stats.imageCount === 0) {
    checks.push(makeCheck('image_alt', 'Image alt attributes', 'neutral', 'No images in content.', 'media'));
  } else {
    checks.push(
      makeCheck(
        'image_alt',
        'Image alt attributes',
        stats.imagesWithoutAlt === 0 ? 'good' : stats.imagesWithoutAlt < stats.imageCount ? 'warn' : 'bad',
        stats.imagesWithoutAlt === 0
          ? 'All content images have alt text.'
          : `${stats.imagesWithoutAlt} of ${stats.imageCount} image(s) missing alt text.`,
        'media'
      )
    );
  }

  const flesch = fleschReadingEase(plainText);
  if (flesch == null || wordCount < 100) {
    checks.push(
      makeCheck(
        'readability',
        'Readability (Flesch)',
        'neutral',
        wordCount < 100 ? 'Add more content to measure readability.' : 'Not enough text to score readability.',
        'content'
      )
    );
  } else {
    let readStatus = 'warn';
    let readMsg = `Flesch score ${flesch} (${fleschLabel(flesch)}) — aim for 60–70 for web articles.`;
    if (flesch >= 60 && flesch <= 70) {
      readStatus = 'good';
      readMsg = `Flesch score ${flesch} (${fleschLabel(flesch)}) — ideal range for web content.`;
    } else if (flesch >= 50 && flesch < 60) {
      readStatus = 'warn';
    } else if (flesch > 70) {
      readStatus = 'good';
      readMsg = `Flesch score ${flesch} (${fleschLabel(flesch)}) — easy to read.`;
    } else {
      readStatus = 'bad';
    }
    checks.push(makeCheck('readability', 'Readability (Flesch)', readStatus, readMsg, 'content'));
  }

  const faqCandidates = extractFaqCandidates(html);
  const howToHint = detectHowToHint(html);
  if (faqCandidates.length >= 2) {
    checks.push(
      makeCheck(
        'faq_schema',
        'FAQ schema opportunity',
        'good',
        `${faqCandidates.length} question headings detected — eligible for FAQ rich results.`,
        'schema'
      )
    );
  } else if (faqCandidates.length === 1) {
    checks.push(
      makeCheck(
        'faq_schema',
        'FAQ schema opportunity',
        'warn',
        '1 FAQ-style heading found — add 1–2 more Q&A sections for FAQ schema.',
        'schema'
      )
    );
  } else if (howToHint) {
    checks.push(
      makeCheck(
        'faq_schema',
        'FAQ schema opportunity',
        'warn',
        'How-to steps detected — consider adding FAQ Q&A sections or HowTo schema.',
        'schema'
      )
    );
  } else {
    checks.push(
      makeCheck(
        'faq_schema',
        'FAQ schema opportunity',
        'neutral',
        'Use H2/H3 headings ending with "?" followed by answers for FAQ schema.',
        'schema'
      )
    );
  }

  const maxScore = Object.values(CHECK_WEIGHTS).reduce((a, b) => a + b, 0);
  const earned = checks.reduce(
    (sum, c) => sum + (c.status === 'neutral' ? c.weight * 0.5 : c.points),
    0
  );
  const score = Math.round(Math.min(100, (earned / maxScore) * 100));
  const { grade, color } = scoreGrade(score);

  const serpTitle = metaTitle || title || 'Untitled post';
  const serpDescription = metaDescription || excerpt || 'No description yet.';
  const siteUrl = (input.siteUrl || 'https://bloomwik.com').replace(/\/$/, '');
  const serpUrl = slug ? `${siteUrl}/article/${slug}` : `${siteUrl}/article/…`;

  const internalLinkSuggestions = suggestInternalLinks({
    focusKeyword,
    tags: input.tags || [],
    siteArticles: input.siteArticles,
    currentSlug: slug,
    linkedSlugs: stats.linkedInternalSlugs,
    categoryName: input.categoryName,
  });

  return {
    score,
    grade,
    gradeColor: color,
    wordCount,
    readability: flesch != null ? { score: flesch, label: fleschLabel(flesch) } : null,
    faq: { candidates: faqCandidates, howToHint },
    suggestions: { internalLinks: internalLinkSuggestions },
    checks,
    serp: {
      title: serpTitle.length > 60 ? `${serpTitle.slice(0, 57)}…` : serpTitle,
      description: serpDescription.length > 160 ? `${serpDescription.slice(0, 157)}…` : serpDescription,
      url: serpUrl,
    },
  };
}

module.exports = {
  analyzeContentSeo,
  stripHtml,
  paragraphsToHtml,
  countWords,
  CHECK_WEIGHTS,
};
