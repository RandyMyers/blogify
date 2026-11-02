const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const rootEnv = path.resolve(__dirname, '..', '..', '.env');
const serverEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
if (fs.existsSync(serverEnv)) dotenv.config({ path: serverEnv });
if (!fs.existsSync(rootEnv) && !fs.existsSync(serverEnv)) dotenv.config();

const Ad = require('../models/Ad');
const Tenant = require('../models/Tenant');
const { uploadToCloudinary } = require('../utils/cloudinaryUpload');

const MICRO1_URL = 'https://refer.micro1.ai/referral/jobs?referralCode=91f4cac8-8259-43bc-a223-d6352ee73886&utm_source=referral&utm_medium=share&utm_campaign=job_referral';
const GTA_URL = 'https://dealcouponz.com/stores/gamivo-discount-codes';

async function findOrCreateCampaign(tenantId, placement, clickUrl, name) {
  const existing = await Ad.find({ tenantId, placement, clickUrl }).sort({ createdAt: 1 });
  if (existing.length > 1) {
    throw new Error(`Multiple ${placement} campaigns already use ${clickUrl}; resolve duplicates before seeding`);
  }
  return existing[0] || new Ad({ tenantId, placement, clickUrl, name });
}

async function saveCampaign(ad, fields) {
  ad.set(fields);
  await ad.save();
}

async function main() {
  if (!process.env.MONGO_URL) throw new Error('MONGO_URL is not set');
  await mongoose.connect(process.env.MONGO_URL);

  const tenant = await Tenant.findOne({ slug: 'bloomwik', isActive: true });
  if (!tenant) throw new Error('Active bloomwik tenant was not found');

  const gtaCreativePath = path.resolve(__dirname, '..', '..', 'ad', 'grand_theft_auto_vi_preorder_deals_v2.png');
  if (!fs.existsSync(gtaCreativePath)) {
    throw new Error(`GTA popup creative was not found: ${gtaCreativePath}`);
  }

  const gtaUpload = await uploadToCloudinary(
    { tempFilePath: gtaCreativePath, name: path.basename(gtaCreativePath) },
    {
      folder: 'blogify/ads',
      public_id: 'gta6-preorder-deals-v2',
      unique_filename: false,
      overwrite: true,
      use_filename: false,
    }
  );

  const popupCampaigns = [
    {
      name: 'Micro1 AI Work Opportunities - Global Popup',
      clickUrl: MICRO1_URL,
      imageUrl: 'https://res.cloudinary.com/dcee0fx6p/image/upload/v1/blogify/ads/file_dvccup.png',
      priority: 100,
    },
    {
      name: 'GTA VI Pre-Order Deals - Global Popup',
      clickUrl: GTA_URL,
      imageUrl: gtaUpload.url,
      priority: 90,
    },
  ];

  for (const campaign of popupCampaigns) {
    const ad = await findOrCreateCampaign(tenant._id, 'popup', campaign.clickUrl, campaign.name);
    await saveCampaign(ad, {
      name: campaign.name,
      type: 'image_popup',
      status: 'active',
      isActive: true,
      placement: 'popup',
      clickUrl: campaign.clickUrl,
      imageUrl: campaign.imageUrl,
      priority: campaign.priority,
      position: 0,
      startDate: null,
      endDate: null,
      maxImpressions: null,
      maxClicks: null,
      targetRegions: [],
      targetCategories: [],
      targetLanguages: [],
    });
  }

  const notificationCampaigns = [
    {
      name: 'Micro1 AI Work Opportunities - Global Notification',
      clickUrl: MICRO1_URL,
      priority: 100,
      title: 'Get paid for what you know',
      message: 'Train AI with your professional expertise, work remotely, and earn for skills you already know.',
      ctaText: 'Apply now',
    },
    {
      name: 'GTA VI Pre-Order Deals - Global Notification',
      clickUrl: GTA_URL,
      priority: 90,
      title: 'Pre-Order GTA 6 for less',
      message: 'Find the latest Gamivo discounts and coupons before you checkout.',
      ctaText: 'Find discounts',
    },
  ];

  for (const campaign of notificationCampaigns) {
    const ad = await findOrCreateCampaign(tenant._id, 'notification', campaign.clickUrl, campaign.name);
    await saveCampaign(ad, {
      name: campaign.name,
      type: 'text_notification',
      status: 'active',
      isActive: true,
      placement: 'notification',
      clickUrl: campaign.clickUrl,
      imageUrl: '',
      htmlContent: '',
      priority: campaign.priority,
      position: 0,
      startDate: null,
      endDate: null,
      maxImpressions: null,
      maxClicks: null,
      targetRegions: [],
      targetCategories: [],
      targetLanguages: [],
      translations: {
        en: {
          title: campaign.title,
          description: '',
          message: campaign.message,
          ctaText: campaign.ctaText,
          imageUrl: '',
          htmlContent: '',
        },
      },
    });
  }

  const seeded = await Ad.find({ tenantId: tenant._id, placement: { $in: ['popup', 'notification'] } })
    .select('name type status isActive placement clickUrl imageUrl priority targetRegions targetLanguages')
    .sort({ placement: 1, priority: -1 })
    .lean();
  console.log(JSON.stringify({ tenant: tenant.slug, gtaCreative: gtaUpload.url, campaigns: seeded }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Failed to seed popup campaigns:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
