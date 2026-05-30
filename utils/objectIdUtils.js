const mongoose = require('mongoose');

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

function isObjectIdString(value) {
  if (typeof value !== 'string') return false;
  if (!OBJECT_ID_RE.test(value)) return false;
  return mongoose.Types.ObjectId.isValid(value);
}

/** Append `{ _id: value }` to a slug $or list when param looks like a MongoDB id. */
function withObjectIdOr(orConditions, value, tenantFilter = {}) {
  if (!isObjectIdString(value)) return orConditions;
  return [...orConditions, { _id: value, ...tenantFilter }];
}

module.exports = {
  OBJECT_ID_RE,
  isObjectIdString,
  withObjectIdOr,
};
