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
} = require(
  '../controllers/auth.controller'
);

const {
  requireAuth,
} = require(
  '../middleware/auth'
);

const router = Router();

// ======================================================
// REGISTRO
// ======================================================

router.post(
  '/register',
  register
);

// ======================================================
// LOGIN EMAIL + CONTRASEÑA
// ======================================================

router.post(
  '/login',
  login
);

// ======================================================
// LOGIN GOOGLE
// ======================================================

router.post(
  '/google',
  googleLogin
);

// ======================================================
// SOLICITAR CÓDIGO DE RECUPERACIÓN
// ======================================================

router.post(
  '/forgot-password',
  forgotPassword
);

// ======================================================
// VERIFICAR CÓDIGO DE RECUPERACIÓN
// ======================================================

router.post(
  '/verify-reset-code',
  verifyResetCode
);

// ======================================================
// USUARIO AUTENTICADO
// ======================================================

router.get(
  '/me',
  requireAuth,
  me
);

module.exports = router;