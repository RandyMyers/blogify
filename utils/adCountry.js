const { REGIONS } = require('../constants/regions');

const normalizeCountryCode = (country) => {
  if (!country || typeof country !== 'string') {
    return null;
  }

  const normalized = country.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(normalized) && REGIONS.some((region) => region.code === normalized)) {
    return normalized;
  }

  const matchingRegion = REGIONS.find(
    (region) => region.name.toUpperCase() === normalized
  );
  return matchingRegion?.code || null;
};

module.exports = { normalizeCountryCode };
