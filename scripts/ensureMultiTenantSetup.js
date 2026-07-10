/**
 * Ensure Bloomwik production and Netlify preview are separate tenants.
 *
 * Usage:
 *   node server/scripts/ensureMultiTenantSetup.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const Tenant = require('../models/Tenant');

const rootEnv = path.resolve(__dirname, '..', '..', '.env');
const serverEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
else if (fs.existsSync(serverEnv)) dotenv.config({ path: serverEnv });
else dotenv.config();

const BLOOMWIK_DOMAINS = ['bloomwik.com', 'www.bloomwik.com'];
const PREVIEW_DOMAINS = ['fabulous-arithmetic-400162.netlify.app'];
const HOSTINGER_DOMAINS = ['darksalmon-chinchilla-651339.hostingersite.com'];

async function upsertTenant({ slug, name, domains, isDefault }) {
  let tenant = await Tenant.findOne({ slug });
  if (!tenant) {
    tenant = await Tenant.create({
      slug,
      name,
      domains,
      isDefault,
      isActive: true,
    });
    console.log(`Created tenant: ${slug}`);
    return tenant;
  }

  const mergedDomains = [
    ...new Set([...(tenant.domains || []), ...domains].map((d) => d.toLowerCase().trim()).filter(Boolean)),
  ];

  tenant.name = name;
  tenant.domains = mergedDomains;
  tenant.isDefault = isDefault;
  tenant.isActive = true;
  await tenant.save();
  console.log(`Updated tenant: ${slug} → ${mergedDomains.join(', ')}`);
  return tenant;
}

async function main() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL);
  console.log('Connected to MongoDB\n');

  if (await Tenant.countDocuments({ isDefault: true }) > 1) {
    const defaults = await Tenant.find({ isDefault: true }).sort({ createdAt: 1 });
    for (let i = 1; i < defaults.length; i += 1) {
      defaults[i].isDefault = false;
      await defaults[i].save();
      console.log(`Unset duplicate default flag on tenant: ${defaults[i].slug}`);
    }
  }

  const bloomwik = await upsertTenant({
    slug: 'bloomwik',
    name: 'Bloomwik',
    domains: BLOOMWIK_DOMAINS,
    isDefault: true,
  });

  const preview = await upsertTenant({
    slug: 'preview',
    name: 'Netlify Preview',
    domains: PREVIEW_DOMAINS,
    isDefault: false,
  });

  const hostinger = await upsertTenant({
    slug: 'hostinger',
    name: 'Hostinger Staging',
    domains: HOSTINGER_DOMAINS,
    isDefault: false,
  });

  preview.domains = PREVIEW_DOMAINS;
  await preview.save();

  hostinger.domains = HOSTINGER_DOMAINS;
  await hostinger.save();

  const legacyDefault = await Tenant.findOne({ slug: 'default' });
  if (legacyDefault && String(legacyDefault._id) !== String(bloomwik._id)) {
    const fromId = legacyDefault._id;
    const toId = bloomwik._id;
    const models = [
      ['Article', require('../models/Article')],
      ['Category', require('../models/Category')],
      ['SeoSettings', require('../models/SeoSettings')],
      ['Comment', require('../models/Comment')],
      ['Ad', require('../models/Ad')],
      ['AdEvent', require('../models/AdEvent')],
      ['Visitor', require('../models/Visitor')],
    ];

    for (const [name, Model] of models) {
      const result = await Model.updateMany({ tenantId: fromId }, { $set: { tenantId: toId } });
      if (result.modifiedCount > 0) {
        console.log(`Migrated ${result.modifiedCount} ${name} records from default → bloomwik`);
      }
    }

    legacyDefault.domains = (legacyDefault.domains || []).filter(
      (d) =>
        !PREVIEW_DOMAINS.includes(d.toLowerCase()) &&
        !BLOOMWIK_DOMAINS.includes(d.toLowerCase()) &&
        !HOSTINGER_DOMAINS.includes(d.toLowerCase())
    );
    legacyDefault.isDefault = false;
    await legacyDefault.save();
    console.log('Cleaned legacy default tenant domains');
  }

  console.log('\nTenant slugs:');
  console.log(`  Production (bloomwik.com): ${bloomwik.slug}`);
  console.log(`  Netlify preview: ${preview.slug}`);
  console.log(`  Hostinger staging: ${hostinger.slug}`);
  console.log('\nSet client env per deployment:');
  console.log('  bloomwik.com:     REACT_APP_TENANT_SLUG=bloomwik');
  console.log('  Netlify preview:  REACT_APP_TENANT_SLUG=preview');
  console.log('  Hostinger staging: REACT_APP_TENANT_SLUG=hostinger');
  console.log('  Hostinger build:  npm run build:hostinger');
  console.log('Admin: select the matching site in the top-bar tenant switcher.\n');

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Setup failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
