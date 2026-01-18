const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../.env.test') });

// Use test database URL or default
const mongoTestUrl = process.env.MONGO_TEST_URL || process.env.MONGO_URL || 'mongodb://localhost:27017/blogify-test';

// Connect to test database
beforeAll(async () => {
  try {
    await mongoose.connect(mongoTestUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to test database');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
});

// Clean up after each test
afterEach(async () => {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  } catch (error) {
    console.error('Error cleaning up test database:', error);
  }
});

// Close connection after all tests
afterAll(async () => {
  try {
    await mongoose.connection.close();
    console.log('Test database connection closed');
  } catch (error) {
    console.error('Error closing test database connection:', error);
  }
});


