const { Router } = require('express');
const ctrl = require('../controllers/reports.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = Router();

// Públicas (no requieren login para ver el mapa/listado, como en el Figma)
router.get('/', optionalAuth, ctrl.list);
router.get('/mine', requireAuth, ctrl.myReports); // antes de /:id para que no choque la ruta
router.get('/:id', optionalAuth, ctrl.getById);

// Requieren login
router.post('/', requireAuth, ctrl.create);
router.put('/:id', requireAuth, ctrl.update);
router.delete('/:id', requireAuth, ctrl.remove);

module.exports = router;
