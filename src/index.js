require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const reportsRoutes = require('./routes/reports.routes');
const adminRoutes = require('./routes/admin.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  })
);

// Limita intentos de login/registro para evitar fuerza bruta
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use('/api/auth', authLimiter, authRoutes);

app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadsRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` }));
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🐾 API de Patitas Tucumán corriendo en http://localhost:${PORT}`);
});
