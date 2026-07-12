/**
 * Backfill per-locale canonical URLs for all articles.
 *
 * Default language: canonical = {siteUrl}/article/{slug}
 * Other locales: canonical = {siteUrl}/{region}/article/{slug} (uses country slug when set)
 *
 * Usage:
 *   node server/scripts/backfillArticleCanonicalUrls.js              # dry run
 *   node server/scripts/backfillArticleCanonicalUrls.js --apply      # write to MongoDB
 *   node server/scripts/backfillArticleCanonicalUrls.js --apply --force  # overwrite all canonicals
 *   node server/scripts/backfillArticleCanonicalUrls.js --apply --fix-wrong  # only fix mismatched/wrong paths
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const rootEnv = path.resolve(__dirname, '..', '..', '.env');
const serverEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
else if (fs.existsSync(serverEnv)) dotenv.config({ path: serverEnv });
else dotenv.config();

const Article = require('../models/Article');
const SeoSettings = require('../models/SeoSettings');
const { applyCanonicalUrlsToPayload, resolveCanonicalForArticle, LANG_PREFERRED_REGION } = require('../utils/canonicalUrl');
const { applySeoScoreToDocument } = require('../utils/articleSeoHelpers');

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const FIX_WRONG = process.argv.includes('--fix-wrong');

const ARTICLE_LANGS = ['en', 'fr', 'es', 'de', 'it', 'pt', 'sv', 'fi', 'da', 'no', 'nl'];

function plainTranslation(tr) {
  if (!tr) return null;
  return typeof tr.toObject === 'function' ? tr.toObject() : { ...tr };
}

function hasTranslationContent(tr) {
  return Boolean(tr?.title?.trim());
}

async function getSiteUrl(tenantId) {
  if (!tenantId) return process.env.CLIENT_URL || 'https://bloomwik.com';
  const settings = await SeoSettings.findOne({ tenantId });
  return settings?.siteUrl || process.env.CLIENT_URL || 'https://bloomwik.com';
}

function normalizeRegionSlugMap(raw) {
  if (!raw) return {};
  if (raw instanceof Map) {
    const obj = {};
    raw.forEach((value, key) => {
      const slug = String(value || '').trim().toLowerCase();
      if (slug) obj[String(key).toUpperCase()] = slug;
    });
    return obj;
  }
  if (typeof raw === 'object') {
    const obj = {};
    Object.entries(raw).forEach(([key, value]) => {
      const slug = String(value || '').trim().toLowerCase();
      if (slug) obj[String(key).toUpperCase()] = slug;
    });
    return obj;
  }
  return {};
}

function buildPayloadFromArticle(article) {
  const translations = {};
  ARTICLE_LANGS.forEach((lang) => {
    const tr = plainTranslation(article.translations?.[lang]);
    if (hasTranslationContent(tr)) {
      translations[lang] = { ...tr };
    }
  });

  return {
    defaultLanguage: article.defaultLanguage || 'en',
    baseSlug: article.baseSlug || article.slug,
    slug: article.baseSlug || article.slug,
    regionSlugs: normalizeRegionSlugMap(article.regionSlugs),
    translations,
  };
}

function expectedCanonical(siteUrl, lang, slug, regionSlugs = {}) {
  const regionCode = LANG_PREFERRED_REGION[lang] || 'US';
  const explicit = regionSlugs[regionCode];
  const effectiveSlug = explicit || slug;
  return resolveCanonicalForArticle({
    stored: '',
    siteUrl,
    regionCode,
    slug: effectiveSlug,
  });
}

function canonicalNeedsFix(current, expected) {
  const cur = String(current || '').trim();
  if (!cur) return true;
  if (!expected) return false;
  return cur !== expected;
}

async function backfillArticleCanonicalUrls() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL is not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL);
  console.log(`MongoDB connected (${APPLY ? 'APPLY' : 'DRY RUN'}${FORCE ? ', FORCE' : ''}${FIX_WRONG ? ', FIX-WRONG' : ''})\n`);

  const articles = await Article.find({});
  let updated = 0;
  let skipped = 0;
  let localeUpdates = 0;

  for (const article of articles) {
    const siteUrl = await getSiteUrl(article.tenantId);
    const payload = buildPayloadFromArticle(article);
    const defaultSlug = payload.baseSlug;

    if (!defaultSlug || Object.keys(payload.translations).length === 0) {
      skipped += 1;
      continue;
    }

    if (!FORCE && !FIX_WRONG) {
      Object.keys(payload.translations).forEach((lang) => {
        const current = String(payload.translations[lang].canonicalUrl || '').trim();
        if (current) {
          payload.translations[lang].canonicalUrl = current;
        }
      });
    }

    const patched = applyCanonicalUrlsToPayload({ ...payload }, siteUrl);
    let articleDirty = false;
    let articleLocaleUpdates = 0;

    ARTICLE_LANGS.forEach((lang) => {
      const existing = plainTranslation(article.translations?.[lang]);
      if (!hasTranslationContent(existing)) return;

      const nextCanonical = patched.translations?.[lang]?.canonicalUrl || '';
      const currentCanonical = String(existing.canonicalUrl || '').trim();
      const regionCode = LANG_PREFERRED_REGION[lang] || 'US';
      const explicitSlug = payload.regionSlugs[regionCode];
      const langSlug = existing.slug || payload.baseSlug;
      const expected = expectedCanonical(siteUrl, lang, langSlug, payload.regionSlugs);

      if (!nextCanonical) return;
      if (!FORCE && !FIX_WRONG && currentCanonical) return;
      if (FIX_WRONG && !FORCE && !canonicalNeedsFix(currentCanonical, expected)) return;
      if (currentCanonical === nextCanonical) return;

      console.log(
        `  ${lang}: ${currentCanonical || '(empty)'} → ${nextCanonical}` +
          (explicitSlug && explicitSlug !== langSlug ? ` [country slug: ${explicitSlug}]` : '')
      );

      article.translations[lang].canonicalUrl = nextCanonical;
      articleDirty = true;
      articleLocaleUpdates += 1;
      localeUpdates += 1;
    });

    if (articleDirty) {
      if (APPLY) {
        applySeoScoreToDocument(article, siteUrl);
        article.markModified('translations');
        await article.save();
        console.log(
          `Updated ${article.baseSlug || article._id}: ${articleLocaleUpdates} locale(s) → SEO ${article.seoScore}`
        );
      } else {
        console.log(
          `[dry-run] ${article.baseSlug || article._id}: ${articleLocaleUpdates} locale(s) would update`
        );
      }
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(
    `\nDone. Articles updated: ${updated}, skipped: ${skipped}, locale canonicals: ${localeUpdates}, total: ${articles.length}`
  );
  if (!APPLY) {
    console.log('Run with --apply to write changes.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  backfillArticleCanonicalUrls().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { backfillArticleCanonicalUrls };
