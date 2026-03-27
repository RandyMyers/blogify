const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Tenant = require('../models/Tenant');
const Category = require('../models/Category');
const Author = require('../models/Author');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
};

const migrateCategoriesAuthorsToTenant = async () => {
  try {
    await connectDB();
    console.log('MongoDB Connected');

    let defaultTenant = await Tenant.findOne({ isDefault: true });
    if (!defaultTenant) {
      defaultTenant = await Tenant.create({
        name: 'Default Website',
        slug: 'default',
        domains: ['localhost', '127.0.0.1'],
        isDefault: true,
        isActive: true
      });
      console.log(`Created default tenant: ${defaultTenant.slug}`);
    }

    const categoriesMissingBefore = await Category.countDocuments({ tenantId: { $exists: false } });
    const authorsMissingBefore = await Author.countDocuments({ tenantId: { $exists: false } });

    const categoriesResult = await Category.updateMany(
      { tenantId: { $exists: false } },
      { $set: { tenantId: defaultTenant._id } }
    );
    const authorsResult = await Author.updateMany(
      { tenantId: { $exists: false } },
      { $set: { tenantId: defaultTenant._id } }
    );

    const categoriesMissingAfter = await Category.countDocuments({ tenantId: { $exists: false } });
    const authorsMissingAfter = await Author.countDocuments({ tenantId: { $exists: false } });

    console.log('Category/Author tenant migration complete');
    console.log(`- Default tenant: ${defaultTenant.slug} (${defaultTenant._id})`);
    console.log(`- Categories missing tenantId before: ${categoriesMissingBefore}`);
    console.log(`- Categories updated: ${categoriesResult.modifiedCount || 0}`);
    console.log(`- Categories missing tenantId after: ${categoriesMissingAfter}`);
    console.log(`- Authors missing tenantId before: ${authorsMissingBefore}`);
    console.log(`- Authors updated: ${authorsResult.modifiedCount || 0}`);
    console.log(`- Authors missing tenantId after: ${authorsMissingAfter}`);

    process.exit(0);
  } catch (error) {
    console.error('Error migrating categories/authors to tenant:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  migrateCategoriesAuthorsToTenant();
}

module.exports = { migrateCategoriesAuthorsToTenant };
