/**
 * Recompute seoScore and ensure translation SEO defaults for all articles.
 * Usage: node server/scripts/backfillArticleSeo.js [--dry-run]
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Article = require('../models/Article');
const SeoSettings = require('../models/SeoSettings');
const { applySeoScoreToDocument } = require('../utils/articleSeoHelpers');

const DRY_RUN = process.argv.includes('--dry-run');

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}

async function getSiteUrl(tenantId) {
  if (!tenantId) return process.env.CLIENT_URL || 'https://bloomwik.com';
  const settings = await SeoSettings.findOne({ tenantId });
  return settings?.siteUrl || process.env.CLIENT_URL || 'https://bloomwik.com';
}

async function backfillArticleSeo() {
  await connectDB();
  console.log(`MongoDB connected${DRY_RUN ? ' (dry run)' : ''}`);

  const articles = await Article.find({});
  let updated = 0;
  let skipped = 0;

  for (const article of articles) {
    const langs = Object.keys(article.translations || {});
    let dirty = false;

    langs.forEach((lang) => {
      const tr = article.translations[lang];
      if (!tr) return;
      if (tr.robots == null || tr.robots === '') {
        tr.robots = 'index,follow';
        dirty = true;
      }
      if (tr.canonicalUrl == null) {
        tr.canonicalUrl = '';
        dirty = true;
      }
      if (tr.ogImage == null) {
        tr.ogImage = '';
        dirty = true;
      }
    });

    const siteUrl = await getSiteUrl(article.tenantId);
    const analysis = applySeoScoreToDocument(article, siteUrl);
    dirty = true;

    if (dirty) {
      if (DRY_RUN) {
        console.log(`[dry-run] ${article.baseSlug || article._id} → SEO ${analysis.score}`);
      } else {
        article.markModified('translations');
        await article.save();
        console.log(`Updated ${article.baseSlug || article._id} → SEO ${analysis.score}`);
      }
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(`Done. Updated: ${updated}, skipped: ${skipped}, total: ${articles.length}`);
  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  backfillArticleSeo().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { backfillArticleSeo };
