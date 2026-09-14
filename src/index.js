require('dotenv').config();
require('express-async-errors');

const compression = require('compression');


const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const reportsRoutes = require('./routes/reports.routes');
const adminRoutes = require('./routes/admin.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const conversationsRoutes = require('./routes/conversations.routes');
const errorHandler = require('./middleware/errorHandler');
const { initSocket } = require('./lib/socket');

const app = express();

app.use(compression());
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));



const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8443',
  'https://www.patitastucuman.com',
  'https://patitastucuman.com',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origen no permitido por CORS'));
    },
    credentials: true,
  })
);

// Limita intentos de login/registro para evitar fuerza bruta
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use('/api/auth', authLimiter, authRoutes);

app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/conversations', conversationsRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` }));
app.use(errorHandler);

// Antes: app.listen(...). Ahora necesitamos el server HTTP "crudo" para
// poder engancharle Socket.IO encima, en el mismo puerto.
const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🐾 API de Patitas Tucumán corriendo en http://localhost:${PORT}`);
});