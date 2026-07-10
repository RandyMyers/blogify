/**
 * Assign articles across bloomwik / preview / hostinger tenants.
 *
 * Target layout:
 *   bloomwik   — 1 article (latest, or --bloomwik-slug=)
 *   preview    — all other articles (Netlify)
 *   hostinger  — none (empty until you add content in admin)
 *
 * Usage:
 *   node server/scripts/assignArticlesByTenant.js
 *   node server/scripts/assignArticlesByTenant.js --dry-run
 *   node server/scripts/assignArticlesByTenant.js --bloomwik-slug=cheap-flights-promo-code-guide
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

function parseBloomwikSlug() {
  const arg = process.argv.find((a) => a.startsWith('--bloomwik-slug='));
  return arg ? arg.split('=')[1].trim() : '';
}

async function main() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL);

  const [bloomwik, preview, hostinger] = await Promise.all([
    Tenant.findOne({ slug: 'bloomwik', isActive: true }),
    Tenant.findOne({ slug: 'preview', isActive: true }),
    Tenant.findOne({ slug: 'hostinger', isActive: true }),
  ]);

  if (!bloomwik || !preview) {
    console.error('Missing bloomwik or preview tenant. Run: npm run setup:tenants');
    process.exit(1);
  }

  const articles = await Article.find({})
    .select('baseSlug title slug tenantId updatedAt createdAt')
    .sort({ updatedAt: -1, createdAt: -1 });

  if (!articles.length) {
    console.log('No articles found.');
    await mongoose.disconnect();
    return;
  }

  const bloomwikSlug = parseBloomwikSlug();
  let bloomwikArticle = bloomwikSlug
    ? articles.find((a) => a.baseSlug === bloomwikSlug || a.slug === bloomwikSlug)
    : null;

  if (!bloomwikArticle) {
    const onBloomwik = articles.filter((a) => String(a.tenantId) === String(bloomwik._id));
    bloomwikArticle = onBloomwik[0] || articles[0];
  }

  const rest = articles.filter((a) => String(a._id) !== String(bloomwikArticle._id));

  console.log('Target distribution:');
  console.log(`  bloomwik (${bloomwik.slug}): 1 article`);
  console.log(`  preview (${preview.slug}):  ${rest.length} article(s)`);
  console.log(`  hostinger (${hostinger?.slug || 'n/a'}): 0 articles`);
  console.log('');
  console.log('Bloomwik article:');
  console.log(`  - ${bloomwikArticle.baseSlug || bloomwikArticle.title}`);
  console.log('');
  console.log('Preview articles:');
  rest.forEach((a) => console.log(`  - ${a.baseSlug || a.title}`));

  if (DRY_RUN) {
    console.log('\nDry run — no changes written.');
    await mongoose.disconnect();
    return;
  }

  await Article.updateOne({ _id: bloomwikArticle._id }, { $set: { tenantId: bloomwik._id } });

  if (rest.length > 0) {
    await Article.updateMany(
      { _id: { $in: rest.map((a) => a._id) } },
      { $set: { tenantId: preview._id } }
    );
  }

  const counts = {
    bloomwik: await Article.countDocuments({ tenantId: bloomwik._id }),
    preview: await Article.countDocuments({ tenantId: preview._id }),
    hostinger: hostinger ? await Article.countDocuments({ tenantId: hostinger._id }) : 0,
  };

  console.log('\nDone.');
  console.log(`  bloomwik:   ${counts.bloomwik} article(s)`);
  console.log(`  preview:    ${counts.preview} article(s)`);
  console.log(`  hostinger:  ${counts.hostinger} article(s)`);

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
