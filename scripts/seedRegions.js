const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Region = require('../models/Region');
const { REGIONS } = require('../constants/regions');

dotenv.config();

/**
 * Upsert all regions from server/data/regions.json (safe for production — does not delete existing).
 *
 * Usage:
 *   npm run seed:regions
 *   node scripts/seedRegions.js --fresh   # wipe and re-insert (dev only)
 */
async function seedRegions() {
  const fresh = process.argv.includes('--fresh');

  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    if (fresh) {
      await Region.deleteMany({});
      console.log('Cleared existing regions (--fresh)');
      const insertedRegions = await Region.insertMany(REGIONS);
      console.log(`Seeded ${insertedRegions.length} regions successfully`);
      process.exit(0);
      return;
    }

    let upserted = 0;
    for (const region of REGIONS) {
      await Region.findOneAndUpdate(
        { code: region.code },
        { ...region, updatedAt: new Date() },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      upserted += 1;
      console.log(`  ✓ ${region.code} — ${region.name}`);
    }

    console.log(`Upserted ${upserted} regions from server/data/regions.json`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding regions:', error);
    process.exit(1);
  }
}

seedRegions();
