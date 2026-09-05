const { Router } = require('express');
const ctrl = require('../controllers/admin.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/stats', ctrl.stats);
router.get('/users', ctrl.listUsers);

module.exports = router;
