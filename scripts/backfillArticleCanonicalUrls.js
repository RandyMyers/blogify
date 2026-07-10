/**
 * Backfill per-locale canonical URLs for all articles.
 *
 * Default language: canonical = {siteUrl}/article/{slug} (or /{region}/article/{slug})
 * Other locales with content: canonical = default-language master URL
 *
 * Usage:
 *   node server/scripts/backfillArticleCanonicalUrls.js              # dry run
 *   node server/scripts/backfillArticleCanonicalUrls.js --apply      # write to MongoDB
 *   node server/scripts/backfillArticleCanonicalUrls.js --apply --force  # overwrite existing
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
const { applyCanonicalUrlsToPayload } = require('../utils/canonicalUrl');
const { applySeoScoreToDocument } = require('../utils/articleSeoHelpers');

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

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
    translations,
  };
}

async function backfillArticleCanonicalUrls() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL is not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL);
  console.log(`MongoDB connected (${APPLY ? 'APPLY' : 'DRY RUN'}${FORCE ? ', FORCE' : ''})\n`);

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

    if (!FORCE) {
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

      if (!nextCanonical) return;
      if (!FORCE && currentCanonical) return;
      if (currentCanonical === nextCanonical) return;

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
        patched.translations &&
          Object.entries(patched.translations).forEach(([lang, tr]) => {
            if (tr?.canonicalUrl) console.log(`  ${lang}: ${tr.canonicalUrl}`);
          });
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
