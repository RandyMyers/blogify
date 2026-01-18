const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Region = require('../models/Region');

dotenv.config();

const regions = [
  { code: 'US', name: 'United States', languages: ['en'], defaultLanguage: 'en', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', languages: ['en'], defaultLanguage: 'en', currency: 'GBP' },
  { code: 'CA', name: 'Canada', languages: ['en', 'fr'], defaultLanguage: 'en', currency: 'CAD' },
  { code: 'AU', name: 'Australia', languages: ['en'], defaultLanguage: 'en', currency: 'AUD' },
  { code: 'FR', name: 'France', languages: ['fr', 'en'], defaultLanguage: 'fr', currency: 'EUR' },
  { code: 'DE', name: 'Germany', languages: ['de', 'en'], defaultLanguage: 'de', currency: 'EUR' },
  { code: 'ES', name: 'Spain', languages: ['es', 'en'], defaultLanguage: 'es', currency: 'EUR' },
  { code: 'IT', name: 'Italy', languages: ['it', 'en'], defaultLanguage: 'it', currency: 'EUR' },
  { code: 'PT', name: 'Portugal', languages: ['pt', 'en'], defaultLanguage: 'pt', currency: 'EUR' },
  { code: 'SE', name: 'Sweden', languages: ['sv', 'en'], defaultLanguage: 'sv', currency: 'SEK' },
  { code: 'NO', name: 'Norway', languages: ['no', 'en'], defaultLanguage: 'no', currency: 'NOK' },
  { code: 'DK', name: 'Denmark', languages: ['da', 'en'], defaultLanguage: 'da', currency: 'DKK' },
  { code: 'FI', name: 'Finland', languages: ['fi', 'sv', 'en'], defaultLanguage: 'fi', currency: 'EUR' },
  { code: 'BE', name: 'Belgium', languages: ['nl', 'fr', 'de', 'en'], defaultLanguage: 'nl', currency: 'EUR' },
  { code: 'NL', name: 'Netherlands', languages: ['nl', 'en'], defaultLanguage: 'nl', currency: 'EUR' },
  { code: 'IE', name: 'Ireland', languages: ['en'], defaultLanguage: 'en', currency: 'EUR' },
  { code: 'LU', name: 'Luxembourg', languages: ['fr', 'de', 'en'], defaultLanguage: 'fr', currency: 'EUR' },
  { code: 'CH', name: 'Switzerland', languages: ['de', 'fr', 'it', 'en'], defaultLanguage: 'de', currency: 'CHF' },
  { code: 'AT', name: 'Austria', languages: ['de', 'en'], defaultLanguage: 'de', currency: 'EUR' }
];

const seedRegions = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Clear existing regions
    await Region.deleteMany({});
    console.log('Cleared existing regions');

    // Insert regions
    const insertedRegions = await Region.insertMany(regions);
    console.log(`Seeded ${insertedRegions.length} regions successfully`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding regions:', error);
    process.exit(1);
  }
};

seedRegions();

