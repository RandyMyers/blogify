/**
 * Backfill tenantId on ads, ad events, and visitors to the Bloomwik tenant.
 *
 * Usage:
 *   node server/scripts/backfillTenantScopedRecords.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const Tenant = require('../models/Tenant');
const Article = require('../models/Article');
const Ad = require('../models/Ad');
const AdEvent = require('../models/AdEvent');
const Visitor = require('../models/Visitor');

const rootEnv = path.resolve(__dirname, '..', '..', '.env');
const serverEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
else if (fs.existsSync(serverEnv)) dotenv.config({ path: serverEnv });
else dotenv.config();

async function resolveBloomwikTenant() {
  return (
    (await Tenant.findOne({ slug: 'bloomwik' })) ||
    (await Tenant.findOne({ slug: 'default' })) ||
    (await Tenant.findOne({ isDefault: true }))
  );
}

async function main() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL);
  const bloomwik = await resolveBloomwikTenant();
  if (!bloomwik) {
    console.error('No Bloomwik/default tenant found. Run ensureMultiTenantSetup.js first.');
    process.exit(1);
  }

  const tenantId = bloomwik._id;
  console.log(`Using tenant: ${bloomwik.slug} (${tenantId})\n`);

  const articleResult = await Article.updateMany(
    { $or: [{ tenantId: null }, { tenantId: { $exists: false } }] },
    { $set: { tenantId } }
  );
  console.log(`Articles without tenantId updated: ${articleResult.modifiedCount}`);

  const adResult = await Ad.updateMany(
    { $or: [{ tenantId: null }, { tenantId: { $exists: false } }] },
    { $set: { tenantId } }
  );
  console.log(`Ads without tenantId updated: ${adResult.modifiedCount}`);

  const eventResult = await AdEvent.updateMany(
    { $or: [{ tenantId: null }, { tenantId: { $exists: false } }] },
    { $set: { tenantId } }
  );
  console.log(`Ad events without tenantId updated: ${eventResult.modifiedCount}`);

  const visitorResult = await Visitor.updateMany(
    { $or: [{ tenantId: null }, { tenantId: { $exists: false } }] },
    { $set: { tenantId } }
  );
  console.log(`Visitors without tenantId updated: ${visitorResult.modifiedCount}`);

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Backfill failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
