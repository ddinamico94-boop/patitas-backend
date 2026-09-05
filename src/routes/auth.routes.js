const { Router } = require('express');
const { register, login, googleLogin, me } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/me', requireAuth, me);

module.exports = router;