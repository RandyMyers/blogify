const express = require('express');
const router = express.Router();
const {
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant
} = require('../controllers/tenantController');
const { protect, isAdmin } = require('../middleware/auth');

router.use(protect, isAdmin);

router.get('/', getTenants);
router.post('/', createTenant);
router.get('/:id', getTenantById);
router.put('/:id', updateTenant);
router.delete('/:id', deleteTenant);

module.exports = router;
