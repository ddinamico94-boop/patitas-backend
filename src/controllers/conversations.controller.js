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
  if (existing) return res.json({ conversation: existing });

  const conversation = await prisma.conversation.create({
    data: { reportId, reporterId: report.userId, helperId: req.user.id },
    include: conversationInclude,
  });
  res.status(201).json({ conversation });
}

// Lista las conversaciones del usuario actual (como reportero o como el que ayuda)
async function mine(req, res) {
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ reporterId: req.user.id }, { helperId: req.user.id }] },
    include: {
      ...conversationInclude,
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ items: conversations });
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

  // Empuja el mensaje en tiempo real solo a quienes estén unidos a este
  // room puntual (y solo pudieron unirse si son reporter o helper: ver socket.js)
  getIO().to(`conversation:${req.params.id}`).emit('message:new', message);

  res.status(201).json({ message });
}

module.exports = { create, mine, getById, listMessages, sendMessage };