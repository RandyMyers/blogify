/**
 * Submit all published article locale URLs to IndexNow.
 *
 * Usage (from server/):
 *   node scripts/submitIndexNowBulk.js
 *   node scripts/submitIndexNowBulk.js --dry-run
 *   node scripts/submitIndexNowBulk.js --slug=bloomwik --limit=200
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const Article = require('../models/Article');
const SeoSettings = require('../models/SeoSettings');
const { buildArticlePublicUrls, submitUrlList } = require('../utils/indexNow');

function parseArgs() {
  const args = process.argv.slice(2);
  const slugArg = args.find((a) => a.startsWith('--slug='));
  const limitIdx = args.indexOf('--limit');
  const limit =
    limitIdx >= 0 ? Number(args[limitIdx + 1]) : null;
  return {
    dryRun: args.includes('--dry-run'),
    slug: (slugArg ? slugArg.split('=')[1] : 'bloomwik').toLowerCase().trim(),
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
  };
}

async function main() {
  const { dryRun, slug, limit } = parseArgs();
  const uri = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGO_URL');
    process.exit(1);
  }

  await mongoose.connect(uri);

  let tenant = await Tenant.findOne({ slug });
  if (!tenant) tenant = await Tenant.findOne({ isDefault: true, isActive: true });
  if (!tenant) {
    console.error(`Tenant "${slug}" not found`);
    process.exit(1);
  }

  const settings = await SeoSettings.findOne({ tenantId: tenant._id }).lean();
  const siteUrl = (settings?.siteUrl || process.env.CLIENT_URL || 'https://bloomwik.com').replace(
    /\/$/,
    ''
  );

  let query = Article.find({ tenantId: tenant._id, published: true }).sort({ updatedAt: -1 });
  if (limit) query = query.limit(limit);
  const articles = await query.lean();

  const urls = [];
  articles.forEach((article) => {
    urls.push(...buildArticlePublicUrls(article, siteUrl));
  });
  const unique = [...new Set(urls)];

  console.log(`Tenant: ${tenant.slug}`);
  console.log(`Site:   ${siteUrl}`);
  console.log(`Articles: ${articles.length}`);
  console.log(`URLs:     ${unique.length}${dryRun ? ' (dry-run)' : ''}`);
  unique.slice(0, 8).forEach((u) => console.log('  ', u));
  if (unique.length > 8) console.log(`  … +${unique.length - 8} more`);

  if (dryRun) {
    await mongoose.disconnect();
    return;
  }

  const result = await submitUrlList(unique, {
    tenantId: tenant._id,
    clientUrl: siteUrl,
  });
  console.log(result);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
