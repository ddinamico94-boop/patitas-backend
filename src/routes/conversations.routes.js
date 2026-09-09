const { Router } = require('express');
const ctrl = require('../controllers/conversations.controller');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// Todas requieren login: no tiene sentido un chat anónimo
router.post('/', requireAuth, ctrl.create);
router.get('/mine', requireAuth, ctrl.mine); // antes de /:id para que no choque la ruta
router.get('/:id', requireAuth, ctrl.getById);
router.get('/:id/messages', requireAuth, ctrl.listMessages);
router.post('/:id/messages', requireAuth, ctrl.sendMessage);
router.patch('/:id/read', requireAuth, ctrl.markRead);

module.exports = router;