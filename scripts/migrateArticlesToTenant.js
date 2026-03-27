const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Article = require('../models/Article');
const Tenant = require('../models/Tenant');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
};

const migrateArticlesToTenant = async () => {
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

    const beforeCount = await Article.countDocuments({ tenantId: { $exists: false } });
    const result = await Article.updateMany(
      { tenantId: { $exists: false } },
      { $set: { tenantId: defaultTenant._id } }
    );
    const afterCount = await Article.countDocuments({ tenantId: { $exists: false } });

    console.log('Tenant migration complete');
    console.log(`- Default tenant: ${defaultTenant.slug} (${defaultTenant._id})`);
    console.log(`- Articles missing tenantId before: ${beforeCount}`);
    console.log(`- Articles updated: ${result.modifiedCount || 0}`);
    console.log(`- Articles missing tenantId after: ${afterCount}`);

    process.exit(0);
  } catch (error) {
    console.error('Error migrating articles to tenant:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  migrateArticlesToTenant();
}

module.exports = { migrateArticlesToTenant };
