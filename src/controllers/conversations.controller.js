const { z } = require('zod');
const prisma = require('../lib/prisma');
const { getIO } = require('../lib/socket');

const createConversationSchema = z.object({
  reportId: z.string().min(1, 'Falta el reporte'),
});

const sendMessageSchema = z.object({
  content: z.string().min(1, 'El mensaje no puede estar vacío').max(2000, 'Mensaje demasiado largo'),
});

const conversationInclude = {
  report: {
    select: {
      id: true,
      name: true,
      status: true,
      zone: true,
      images: { take: 1, orderBy: { order: 'asc' } },
    },
  },
  reporter: { select: { id: true, name: true, avatarUrl: true } },
  helper: { select: { id: true, name: true, avatarUrl: true } },
};

// Crea una conversación entre el usuario actual (como "helper") y el dueño del
// reporte, o devuelve la que ya existe para ese mismo reporte + usuario.
async function create(req, res) {
  const { reportId } = createConversationSchema.parse(req.body);

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return res.status(404).json({ error: 'Reporte no encontrado.' });
  if (!report.userId) {
    return res.status(400).json({ error: 'Este reporte no tiene un usuario registrado para contactar.' });
  }
  if (report.userId === req.user.id) {
    return res.status(400).json({ error: 'No podés iniciar una conversación con tu propio reporte.' });
  }

  const existing = await prisma.conversation.findUnique({
    where: { reportId_helperId: { reportId, helperId: req.user.id } },
    include: conversationInclude,
  });
  if (existing) return res.json({ conversation: { ...existing, unreadCount: 0 } });

  const conversation = await prisma.conversation.create({
    data: { reportId, reporterId: report.userId, helperId: req.user.id },
    include: conversationInclude,
  });
  res.status(201).json({ conversation: { ...conversation, unreadCount: 0 } });
}

// Lista las conversaciones del usuario actual (como reportero o como el que ayuda),
// con la cantidad de mensajes no leídos de cada una (mensajes de la otra persona
// posteriores a la última vez que este usuario la abrió).
async function mine(req, res) {
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ reporterId: req.user.id }, { helperId: req.user.id }] },
    include: {
      ...conversationInclude,
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const withUnread = await Promise.all(
    conversations.map(async (c) => {
      const isReporter = c.reporterId === req.user.id;
      const lastReadAt = isReporter ? c.reporterLastReadAt : c.helperLastReadAt;

      const unreadCount = await prisma.message.count({
        where: {
          conversationId: c.id,
          senderId: { not: req.user.id },
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        },
      });

      return { ...c, unreadCount };
    })
  );

  res.json({ items: withUnread });
}

// Devuelve la conversación si existe y el usuario participa; false si no participa; null si no existe.
async function findIfParticipant(conversationId, userId) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return null;
  if (conversation.reporterId !== userId && conversation.helperId !== userId) return false;
  return conversation;
}

async function getById(req, res) {
  const conversation = await findIfParticipant(req.params.id, req.user.id);
  if (conversation === null) return res.status(404).json({ error: 'Conversación no encontrada.' });
  if (conversation === false) return res.status(403).json({ error: 'No tenés acceso a esta conversación.' });

  const full = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: conversationInclude,
  });
  res.json({ conversation: full });
}

async function listMessages(req, res) {
  const conversation = await findIfParticipant(req.params.id, req.user.id);
  if (conversation === null) return res.status(404).json({ error: 'Conversación no encontrada.' });
  if (conversation === false) return res.status(403).json({ error: 'No tenés acceso a esta conversación.' });

  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ items: messages });
}

async function sendMessage(req, res) {
  const { content } = sendMessageSchema.parse(req.body);
  const conversation = await findIfParticipant(req.params.id, req.user.id);
  if (conversation === null) return res.status(404).json({ error: 'Conversación no encontrada.' });
  if (conversation === false) return res.status(403).json({ error: 'No tenés acceso a esta conversación.' });

  const message = await prisma.message.create({
    data: { conversationId: req.params.id, senderId: req.user.id, content },
  });

  // Para que la lista de conversaciones se pueda ordenar por "más reciente"
  await prisma.conversation.update({
    where: { id: req.params.id },
    data: { updatedAt: new Date() },
  });

  const io = getIO();

  // A quien tenga esta conversación abierta ahora mismo (room de la conversación)
  io.to(`conversation:${req.params.id}`).emit('message:new', message);

  // A ambos participantes, tengan o no el chat abierto (room personal de cada
  // usuario), para actualizar el contador de "no leídos" en la lista al instante.
  io
    .to(`user:${conversation.reporterId}`)
    .to(`user:${conversation.helperId}`)
    .emit('conversation:updated', { conversationId: req.params.id, message });

  res.status(201).json({ message });
}

// Marca la conversación como leída hasta este momento, para el usuario actual.
async function markRead(req, res) {
  const conversation = await findIfParticipant(req.params.id, req.user.id);
  if (conversation === null) return res.status(404).json({ error: 'Conversación no encontrada.' });
  if (conversation === false) return res.status(403).json({ error: 'No tenés acceso a esta conversación.' });

  const isReporter = conversation.reporterId === req.user.id;

  await prisma.conversation.update({
    where: { id: req.params.id },
    data: isReporter ? { reporterLastReadAt: new Date() } : { helperLastReadAt: new Date() },
  });

  res.json({ ok: true });
}

module.exports = { create, mine, getById, listMessages, sendMessage, markRead };