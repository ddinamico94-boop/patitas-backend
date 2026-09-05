const { verifyToken } = require('../utils/jwt');
const prisma = require('../lib/prisma');

/** Requiere estar logueado. Adjunta req.user (sin passwordHash). */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No autenticado. Falta el token.' });
  }

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }

    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

/** Igual que requireAuth pero no falla si no hay token (para rutas públicas con extras si hay user). */
async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user) {
      req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    }
  } catch (_err) {
    // token inválido: seguimos como anónimo
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Requiere permisos de administrador.' });
  }
  next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin };
