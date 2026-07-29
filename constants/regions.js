const REGIONS = require('../data/regions.json');

const REGION_CODES = REGIONS.map((region) => region.code);

const DEFAULT_REGION_LANGUAGES = Object.fromEntries(
  REGIONS.map((region) => [region.code, region.defaultLanguage])
);

module.exports = {
  REGIONS,
  REGION_CODES,
  DEFAULT_REGION_LANGUAGES,
};
