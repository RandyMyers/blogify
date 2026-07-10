/**
 * Move the latest article to bloomwik tenant; all others to preview (Netlify).
 *
 * Usage:
 *   node server/scripts/splitArticlesByTenant.js
 *   node server/scripts/splitArticlesByTenant.js --dry-run
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const Tenant = require('../models/Tenant');
const Article = require('../models/Article');

const rootEnv = path.resolve(__dirname, '..', '..', '.env');
const serverEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
else if (fs.existsSync(serverEnv)) dotenv.config({ path: serverEnv });
else dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL);

  const bloomwik = await Tenant.findOne({ slug: 'bloomwik', isActive: true });
  const preview = await Tenant.findOne({ slug: 'preview', isActive: true });

  if (!bloomwik || !preview) {
    console.error('Missing bloomwik or preview tenant. Run: npm run setup:tenants');
    process.exit(1);
  }

  const articles = await Article.find({})
    .select('baseSlug title published publishedAt updatedAt createdAt tenantId')
    .sort({ updatedAt: -1, createdAt: -1 });

  if (!articles.length) {
    console.log('No articles found.');
    await mongoose.disconnect();
    return;
  }

  const latest = articles[0];
  const rest = articles.slice(1);

  console.log(`Bloomwik tenant: ${bloomwik.slug} (${bloomwik._id})`);
  console.log(`Preview tenant:  ${preview.slug} (${preview._id})`);
  console.log(`Total articles:  ${articles.length}`);
  console.log('');
  console.log('Latest article → bloomwik:');
  console.log(`  - ${latest.baseSlug || latest.title} (${latest._id})`);
  console.log(`    updatedAt: ${latest.updatedAt?.toISOString?.() || latest.updatedAt}`);
  console.log('');
  console.log(`Other articles → preview: ${rest.length}`);
  rest.forEach((a) => {
    console.log(`  - ${a.baseSlug || a.title}`);
  });

  if (DRY_RUN) {
    console.log('\nDry run — no changes written.');
    await mongoose.disconnect();
    return;
  }

  await Article.updateOne({ _id: latest._id }, { $set: { tenantId: bloomwik._id } });
  if (rest.length > 0) {
    await Article.updateMany(
      { _id: { $in: rest.map((a) => a._id) } },
      { $set: { tenantId: preview._id } }
    );
  }

  const bloomwikCount = await Article.countDocuments({ tenantId: bloomwik._id });
  const previewCount = await Article.countDocuments({ tenantId: preview._id });

  console.log('\nDone.');
  console.log(`  bloomwik: ${bloomwikCount} article(s)`);
  console.log(`  preview:  ${previewCount} article(s)`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
