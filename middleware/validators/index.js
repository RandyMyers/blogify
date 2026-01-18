/**
 * Centralized export for all validators
 */
module.exports = {
  authValidator: require('./authValidator'),
  articleValidator: require('./articleValidator'),
  categoryValidator: require('./categoryValidator'),
  authorValidator: require('./authorValidator'),
  newsletterValidator: require('./newsletterValidator'),
  contactValidator: require('./contactValidator')
};


