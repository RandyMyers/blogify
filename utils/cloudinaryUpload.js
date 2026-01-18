const cloudinary = require('cloudinary').v2;
const cloudinaryConfig = require('../config/cloudinary');

// Validate Cloudinary configuration
const isCloudinaryConfigured = cloudinaryConfig.cloud_name && cloudinaryConfig.api_key && cloudinaryConfig.api_secret;

if (!isCloudinaryConfigured) {
  console.error('⚠️  Cloudinary configuration is incomplete!');
  console.error('Please set the following environment variables in your .env file:');
  console.error('  - CLOUDINARY_CLOUD_NAME');
  console.error('  - CLOUDINARY_API_KEY');
  console.error('  - CLOUDINARY_API_SECRET');
  console.error('\nGet your credentials from: https://cloudinary.com/console');
}

// Configure Cloudinary (will fail gracefully if not configured)
if (isCloudinaryConfigured) {
  cloudinary.config(cloudinaryConfig);
} else {
  console.warn('⚠️  Cloudinary is not configured. Image uploads will fail until credentials are set.');
}

/**
 * Upload image to Cloudinary
 * @param {Object} file - File object from express-fileupload
 * @param {Object} options - Upload options (folder, transformation, etc.)
 * @returns {Promise<Object>} - Cloudinary upload result
 */
const uploadToCloudinary = async (file, options = {}) => {
  // Check if Cloudinary is configured
  const isConfigured = cloudinaryConfig.cloud_name && cloudinaryConfig.api_key && cloudinaryConfig.api_secret;
  
  if (!isConfigured) {
    throw new Error('Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables in your .env file.');
  }
  
  try {
    // Default options
    const uploadOptions = {
      resource_type: 'image',
      folder: options.folder || 'blogify',
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      ...options,
    };

    // If file is in temp file (express-fileupload with useTempFiles: true)
    if (file.tempFilePath) {
      const fs = require('fs');
      
      // Check if temp file exists
      if (!fs.existsSync(file.tempFilePath)) {
        throw new Error(`Temporary file not found: ${file.tempFilePath}`);
      }
      
      const result = await cloudinary.uploader.upload(file.tempFilePath, uploadOptions);
      
      if (!result || !result.secure_url) {
        throw new Error('Cloudinary upload succeeded but returned invalid result');
      }
      
      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      };
    }
    
    // If file is in memory (express-fileupload with useTempFiles: false)
    if (file.data) {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error('Cloudinary upload stream error:', error);
              reject(error);
            } else if (!result || !result.secure_url) {
              reject(new Error('Cloudinary returned no result or invalid result'));
            } else {
              resolve({
                success: true,
                url: result.secure_url,
                publicId: result.public_id,
                width: result.width,
                height: result.height,
                format: result.format,
                bytes: result.bytes,
              });
            }
          }
        );
        uploadStream.end(file.data);
      });
    }

    // Log file structure for debugging
    console.error('Invalid file format. File structure:', {
      hasTempFilePath: !!file.tempFilePath,
      hasData: !!file.data,
      keys: Object.keys(file),
      mimetype: file.mimetype,
      name: file.name
    });
    
    throw new Error('Invalid file format. File must have tempFilePath or data property.');
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    
    // Better error message handling
    let errorMessage = 'Failed to upload image';
    
    if (error.message && typeof error.message === 'string') {
      errorMessage = `Failed to upload image: ${error.message}`;
    } else if (error.http_code) {
      errorMessage = `Cloudinary error (${error.http_code}): ${error.message || 'Unknown error'}`;
    } else if (typeof error === 'string') {
      errorMessage = `Failed to upload image: ${error}`;
    } else {
      errorMessage = 'Failed to upload image. Please check your Cloudinary configuration and try again.';
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} - Deletion result
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: result.result === 'ok',
      result: result.result,
    };
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
};

