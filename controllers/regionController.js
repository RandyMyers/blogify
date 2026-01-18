const Region = require('../models/Region');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @desc    Get all active regions
 * @route   GET /api/regions
 * @access  Public
 */
exports.getAllRegions = asyncHandler(async (req, res) => {
  const regions = await Region.find({ isActive: true }).sort({ name: 1 });
  
  res.json({
    success: true,
    count: regions.length,
    data: regions
  });
});

/**
 * @desc    Get single region by code
 * @route   GET /api/regions/:code
 * @access  Public
 */
exports.getRegionByCode = asyncHandler(async (req, res) => {
  const region = await Region.findOne({ 
    code: req.params.code.toUpperCase(),
    isActive: true 
  });
  
  if (!region) {
    return res.status(404).json({ 
      success: false, 
      message: 'Region not found' 
    });
  }
  
  res.json({
    success: true,
    data: region
  });
});

/**
 * @desc    Set user region preference (saves to cookie)
 * @route   POST /api/regions/set
 * @access  Public
 */
exports.setUserRegion = asyncHandler(async (req, res) => {
  const { regionCode } = req.body;
  
  if (!regionCode) {
    return res.status(400).json({
      success: false,
      message: 'Region code is required'
    });
  }
  
  const region = await Region.findOne({ 
    code: regionCode.toUpperCase(),
    isActive: true 
  });
  
  if (!region) {
    return res.status(404).json({ 
      success: false, 
      message: 'Region not found' 
    });
  }
  
  // Set cookie
  res.cookie('region', region.code, {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  
  res.json({ 
    success: true, 
    data: region,
    message: 'Region preference saved' 
  });
});

/**
 * @desc    Get regions by language
 * @route   GET /api/regions/language/:lang
 * @access  Public
 */
exports.getRegionsByLanguage = asyncHandler(async (req, res) => {
  const { lang } = req.params;
  
  const regions = await Region.find({ 
    languages: lang.toLowerCase(),
    isActive: true 
  }).sort({ name: 1 });
  
  res.json({
    success: true,
    count: regions.length,
    data: regions
  });
});









