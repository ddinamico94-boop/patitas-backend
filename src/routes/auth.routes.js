const {
  Router,
} = require('express');

const {
  register,
  login,
  googleLogin,
  me,
  forgotPassword,
} = require(
  '../controllers/auth.controller'
);

const {
  requireAuth,
} = require(
  '../middleware/auth'
);

const router = Router();

// Registro
router.post(
  '/register',
  register
);

// Login con email y contraseña
router.post(
  '/login',
  login
);

// Login con Google
router.post(
  '/google',
  googleLogin
);

// Solicitar código para recuperar contraseña
router.post(
  '/forgot-password',
  forgotPassword
);

// Obtener usuario autenticado
router.get(
  '/me',
  requireAuth,
  me
);

module.exports = router;