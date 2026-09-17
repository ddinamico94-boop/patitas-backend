const {
  Router,
} = require('express');

const {
  register,
  login,
  googleLogin,
  me,
  forgotPassword,
  verifyResetCode,
  resetPassword,
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

// Login normal
router.post(
  '/login',
  login
);

// Login Google
router.post(
  '/google',
  googleLogin
);

// Solicitar código
router.post(
  '/forgot-password',
  forgotPassword
);

// Verificar código
router.post(
  '/verify-reset-code',
  verifyResetCode
);

// Establecer nueva contraseña
router.post(
  '/reset-password',
  resetPassword
);

// Usuario autenticado
router.get(
  '/me',
  requireAuth,
  me
);

module.exports = router;