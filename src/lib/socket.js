const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const prisma = require('./prisma');

let io = null;

/**
 * Inicializa Socket.IO sobre el mismo servidor HTTP de Express.
 * Cada socket se autentica con el JWT propio (el mismo que usa requireAuth),
 * y solo puede unirse a una conversación si es reporter o helper de esa
 * conversación. Así los mensajes en tiempo real quedan tan privados como
 * ya lo están las rutas HTTP.
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      credentials: true,
    },
  });

  // Middleware de auth para cada conexión de socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No autenticado. Falta el token.'));

      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) return next(new Error('Usuario no encontrado.'));

      socket.user = { id: user.id, name: user.name, email: user.email, role: user.role };
      next();
    } catch (err) {
      next(new Error('Token inválido o expirado.'));
    }
  });

  io.on('connection', (socket) => {
    // Room personal del usuario: sirve para avisarle de novedades (mensajes
    // nuevos en cualquier conversación suya, para el contador de "no leídos")
    // sin necesidad de que tenga esa conversación puntual abierta.
    socket.join(`user:${socket.user.id}`);

    // El cliente pide unirse a una conversación puntual; acá validamos que
    // realmente participe de ella antes de meterlo al room.
    socket.on('conversation:join', async (conversationId, ack) => {
      try {
        const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });

        if (!conversation) {
          return ack?.({ ok: false, error: 'Conversación no encontrada.' });
        }
        if (conversation.reporterId !== socket.user.id && conversation.helperId !== socket.user.id) {
          return ack?.({ ok: false, error: 'No tenés acceso a esta conversación.' });
        }

        socket.join(`conversation:${conversationId}`);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: 'Error al unirse a la conversación.' });
      }
    });

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });
  });

  return io;
}

/** Para usar desde los controllers (ej: emitir un mensaje nuevo). */
function getIO() {
  if (!io) throw new Error('Socket.IO no está inicializado todavía.');
  return io;
}

module.exports = { initSocket, getIO };