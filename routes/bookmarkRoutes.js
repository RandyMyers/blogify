const express = require('express');
const router = express.Router();
const {
  addBookmark,
  removeBookmark,
  getBookmarks,
  checkBookmark,
  getBookmarkCount
} = require('../controllers/bookmarkController');
const { protect } = require('../middleware/auth');

// Public route - get bookmark count
router.get('/count/:articleId', getBookmarkCount);

// All other routes require authentication
router.use(protect);

router.post('/', addBookmark);
router.get('/', getBookmarks);
router.get('/check/:articleId', checkBookmark);
router.delete('/:articleId', removeBookmark);

module.exports = router;


