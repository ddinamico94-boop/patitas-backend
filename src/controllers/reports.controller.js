const { z } = require('zod');
const prisma = require('../lib/prisma');

const AnimalType = z.enum(['perro', 'gato', 'otro']);
const AnimalStatus = z.enum(['perdido', 'encontrado', 'en_calle', 'ayudado', 'rescatado']);

const createReportSchema = z.object({
  name: z.string().min(1, 'El nombre del animal es obligatorio'),
  type: AnimalType,
  status: AnimalStatus.default('perdido'),
  zone: z.string().min(1, 'La zona es obligatoria'),
  address: z.string().optional(),
  description: z.string().optional(),
  breed: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  contactName: z.string().min(1, 'El nombre de contacto es obligatorio'),
  phone: z.string().min(1, 'El teléfono es obligatorio'),
  email: z.string().email('Email de contacto inválido'),
  mapLat: z.number().optional(),
  mapLng: z.number().optional(),
  images: z.array(z.string().url()).optional().default([]),
});

const updateReportSchema = createReportSchema.partial();

const listQuerySchema = z.object({
  status: AnimalStatus.optional(),
  type: AnimalType.optional(),
  zone: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

const reportInclude = { images: { orderBy: { order: 'asc' } } };

async function list(req, res) {
  const q = listQuerySchema.parse(req.query);

  const where = {
    ...(q.status && { status: q.status }),
    ...(q.type && { type: q.type }),
    ...(q.zone && { zone: q.zone }),
    ...(q.search && {
      OR: [
        { name: { contains: q.search, mode: 'insensitive' } },
        { breed: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: reportInclude,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.report.count({ where }),
  ]);

  res.json({ items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) });
}

async function getById(req, res) {
  const report = await prisma.report.findUnique({
    where: { id: req.params.id },
    include: reportInclude,
  });

  if (!report) return res.status(404).json({ error: 'Reporte no encontrado.' });
  res.json({ report });
}

async function create(req, res) {
  const data = createReportSchema.parse(req.body);
  const { images, ...rest } = data;

  const report = await prisma.report.create({
    data: {
      ...rest,
      userId: req.user?.id,
      images: { create: images.map((url, order) => ({ url, order })) },
    },
    include: reportInclude,
  });

  res.status(201).json({ report });
}

async function update(req, res) {
  const existing = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Reporte no encontrado.' });

  const isOwner = existing.userId === req.user.id;
  const isAdmin = req.user.role === 'ADMIN';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'No podés editar un reporte que no es tuyo.' });
  }

  const data = updateReportSchema.parse(req.body);
  const { images, ...rest } = data;

  const report = await prisma.report.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      ...(images && {
        images: {
          deleteMany: {},
          create: images.map((url, order) => ({ url, order })),
        },
      }),
    },
    include: reportInclude,
  });

  res.json({ report });
}

async function remove(req, res) {
  const existing = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Reporte no encontrado.' });

  const isOwner = existing.userId === req.user.id;
  const isAdmin = req.user.role === 'ADMIN';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'No podés borrar un reporte que no es tuyo.' });
  }

  await prisma.report.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

async function myReports(req, res) {
  const items = await prisma.report.findMany({
    where: { userId: req.user.id },
    include: reportInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items });
}

module.exports = { list, getById, create, update, remove, myReports };
