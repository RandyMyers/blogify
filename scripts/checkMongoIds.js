/**
 * Check whether MongoDB ObjectIds exist in the database.
 *
 * Usage:
 *   npm run check:ids
 *   node scripts/checkMongoIds.js 6a19d7dbcbdd5c2eef6fb9d2 6a1a109900af4f0e69ff2619
 *
 * Defaults to Netlify preview referrer IDs from analytics when no args are passed.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Article = require('../models/Article');
const Author = require('../models/Author');
const Category = require('../models/Category');
const Comment = require('../models/Comment');
const User = require('../models/users');
const Tenant = require('../models/Tenant');
const { isObjectIdString } = require('../utils/objectIdUtils');

const DEFAULT_IDS = [
  '6a19d7dbcbdd5c2eef6fb9d2',
  '6a1a109900af4f0e69ff2619',
  '6a19c96b2db8a21b16899a0d',
  '6a1a9a1549528cb3c5f65889',
];

const COLLECTIONS = [
  {
    name: 'Article',
    model: Article,
    label: (doc) => doc.baseSlug || doc.slug || doc._id.toString(),
  },
  {
    name: 'Author',
    model: Author,
    label: (doc) => doc.name || doc.baseSlug || doc.slug || doc._id.toString(),
  },
  {
    name: 'Category',
    model: Category,
    label: (doc) => doc.name || doc.baseSlug || doc.slug || doc._id.toString(),
  },
  {
    name: 'Comment',
    model: Comment,
    label: (doc) => doc.authorName || doc._id.toString(),
  },
  {
    name: 'User',
    model: User,
    label: (doc) => doc.email || doc.username || doc._id.toString(),
  },
  {
    name: 'Tenant',
    model: Tenant,
    label: (doc) => doc.name || doc.slug || doc._id.toString(),
  },
];

function parseIds() {
  const cliIds = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const ids = cliIds.length > 0 ? cliIds : DEFAULT_IDS;
  const invalid = ids.filter((id) => !isObjectIdString(id));
  if (invalid.length) {
    console.error('Invalid ObjectId(s):', invalid.join(', '));
    process.exit(1);
  }
  return ids;
}

async function lookupId(id) {
  const matches = [];

  for (const { name, model, label } of COLLECTIONS) {
    const doc = await model.findById(id).lean();
    if (doc) {
      matches.push({ collection: name, label: label(doc) });
    }
  }

  return matches;
}

async function main() {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUrl) {
    console.error('MONGO_URL (or MONGODB_URI) is not set in server/.env');
    process.exit(1);
  }

  const ids = parseIds();

  await mongoose.connect(mongoUrl);
  console.log(`Connected to MongoDB — checking ${ids.length} id(s)\n`);

  let foundCount = 0;

  for (const id of ids) {
    const matches = await lookupId(id);
    if (matches.length === 0) {
      console.log(`${id}  →  NOT FOUND in any collection`);
    } else {
      foundCount += 1;
      console.log(`${id}  →  FOUND:`);
      matches.forEach(({ collection, label }) => {
        console.log(`         ${collection}: ${label}`);
      });
    }
    console.log('');
  }

  console.log(`Summary: ${foundCount}/${ids.length} id(s) matched at least one document`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
