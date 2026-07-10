const express = require('express');
const router = express.Router();
const {
  getPrerenderPages,
  renderPrerenderPage,
} = require('../controllers/prerenderDataController');

router.get('/pages', getPrerenderPages);
router.post('/render', renderPrerenderPage);

module.exports = router;
