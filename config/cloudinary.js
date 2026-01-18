/**
 * Cloudinary Configuration
 * 
 * This file exports Cloudinary configuration settings.
 * Make sure to set the following environment variables:
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 */
const dotenv = require('dotenv');
const path = require('path');

// Load .env from root directory (parent of server directory)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });



module.exports = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
};


