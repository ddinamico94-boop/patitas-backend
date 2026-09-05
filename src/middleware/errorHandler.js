const { ZodError } = require('zod');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos inválidos.',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  if (err.code === 'P2002') {
    // Prisma: violación de unique constraint
    return res.status(409).json({ error: 'Ese registro ya existe (email duplicado, etc).' });
  }

  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor.' });
}

module.exports = errorHandler;
