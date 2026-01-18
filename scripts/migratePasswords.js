const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const User = require('../models/users');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const SALT_ROUNDS = 12;

/**
 * Migrate plain text passwords to bcrypt hashed passwords
 * This script should be run once to migrate existing users
 */
async function migratePasswords() {
  try {
    // Validate MongoDB URL
    if (!process.env.MONGO_URL) {
      console.error('MONGO_URL environment variable is required');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    const users = await User.find({});
    console.log(`Found ${users.length} users to check`);

    let migrated = 0;
    let alreadyHashed = 0;
    let errors = 0;

    for (const user of users) {
      try {
        // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
        if (user.password && user.password.startsWith('$2')) {
          alreadyHashed++;
          continue;
        }

        // Skip if password is empty or null
        if (!user.password) {
          console.log(`Skipping user ${user.email} - no password set`);
          continue;
        }

        console.log(`Migrating password for user: ${user.email}`);
        const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
        user.password = hashedPassword;
        await user.save();
        migrated++;
      } catch (error) {
        console.error(`Error migrating user ${user.email}:`, error.message);
        errors++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total users checked: ${users.length}`);
    console.log(`Passwords migrated: ${migrated}`);
    console.log(`Already hashed: ${alreadyHashed}`);
    console.log(`Errors: ${errors}`);

    if (migrated > 0) {
      console.log('\n✅ Migration complete!');
    } else {
      console.log('\n✅ No passwords needed migration.');
    }

    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run migration
migratePasswords();


