const express = require('express');
const {
  getReaders,
  updateReaderBan,
  deleteReader,
} = require('../controllers/readerAdminController');
const { protect, isAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(protect, isAdmin);

router.get('/', getReaders);
router.patch('/:id/ban', updateReaderBan);
router.delete('/:id', deleteReader);

module.exports = router;
