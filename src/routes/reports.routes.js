const { Router } = require('express');
const ctrl = require('../controllers/reports.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = Router();

// Públicas
router.get('/', optionalAuth, ctrl.list);

// Sitemap dinámico
router.get('/sitemap.xml', ctrl.sitemap);


router.get('/share/:id', ctrl.sharePreview);


// Reportes del usuario logueado
router.get('/mine', requireAuth, ctrl.myReports);


// Reporte individual
router.get('/:id', optionalAuth, ctrl.getById);

// Requieren login
router.post('/', requireAuth, ctrl.create);
router.put('/:id', requireAuth, ctrl.update);
router.delete('/:id', requireAuth, ctrl.remove);

module.exports = router;
