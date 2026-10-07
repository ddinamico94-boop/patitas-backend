const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const prisma = require('./prisma');

let io = null;

/**
 * Inicializa Socket.IO sobre el mismo servidor HTTP de Express.
 *
 * Cada conexión utiliza el mismo JWT que las rutas HTTP.
 * Los administradores pueden entrar al room "admins" para recibir
 * actualizaciones del panel en tiempo real.
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      credentials: true,
    },
  });

  // Autenticación del socket mediante JWT
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(
          new Error('No autenticado. Falta el token.')
        );
      }

      const payload = verifyToken(token);

      const user = await prisma.user.findUnique({
        where: {
          id: payload.sub,
        },
      });

      if (!user) {
        return next(
          new Error('Usuario no encontrado.')
        );
      }

      socket.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (err) {
      next(
        new Error(
          'Token inválido o expirado.'
        )
      );
    }
  });

  io.on('connection', (socket) => {
    // Room personal del usuario
    socket.join(
      `user:${socket.user.id}`
    );

    // Los administradores reciben eventos del panel
    if (socket.user.role === 'ADMIN') {
      socket.join('admins');
    }

    // Unirse a una conversación
    socket.on(
      'conversation:join',
      async (conversationId, ack) => {
        try {
          const conversation =
            await prisma.conversation.findUnique({
              where: {
                id: conversationId,
              },
            });

          if (!conversation) {
            return ack?.({
              ok: false,
              error:
                'Conversación no encontrada.',
            });
          }

          if (
            conversation.reporterId !==
              socket.user.id &&
            conversation.helperId !==
              socket.user.id
          ) {
            return ack?.({
              ok: false,
              error:
                'No tenés acceso a esta conversación.',
            });
          }

          socket.join(
            `conversation:${conversationId}`
          );

          ack?.({
            ok: true,
          });
        } catch (err) {
          ack?.({
            ok: false,
            error:
              'Error al unirse a la conversación.',
          });
        }
      }
    );

    socket.on(
      'conversation:leave',
      (conversationId) => {
        socket.leave(
          `conversation:${conversationId}`
        );
      }
    );
  });

  return io;
}

/**
 * Devuelve la instancia global de Socket.IO.
 */
function getIO() {
  if (!io) {
    throw new Error(
      'Socket.IO no está inicializado todavía.'
    );
  }

  return io;
}

/**
 * Emite una actualización a todos los administradores
 * conectados al panel.
 */
function emitAdmin(event, data) {
  if (!io) {
    return;
  }

  io.to('admins').emit(
    event,
    data
  );
}

module.exports = {
  initSocket,
  getIO,
  emitAdmin,
};