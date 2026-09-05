const prisma = require('../lib/prisma');

async function stats(_req, res) {
  const [total, pending, helped, rescued, byStatus, allReports, users] = await Promise.all([
    prisma.report.count(),
    prisma.report.count({ where: { status: { in: ['perdido', 'en_calle'] } } }),
    prisma.report.count({ where: { status: 'ayudado' } }),
    prisma.report.count({ where: { status: 'rescatado' } }),
    prisma.report.groupBy({ by: ['status'], _count: true }),
    prisma.report.findMany({ select: { zone: true, createdAt: true, status: true } }),
    prisma.user.count(),
  ]);

  // Reportes por mes (últimos 7 meses)
  const monthlyMap = {};
  allReports.forEach((r) => {
    const key = r.createdAt.toLocaleDateString('es-AR', { month: 'short' });
    monthlyMap[key] = (monthlyMap[key] || 0) + 1;
  });

  // Reportes por zona (top 5)
  const zoneMap = {};
  allReports.forEach((r) => {
    zoneMap[r.zone] = (zoneMap[r.zone] || 0) + 1;
  });
  const byZone = Object.entries(zoneMap)
    .map(([zone, count]) => ({ zone, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    kpis: { total, pending, helped, rescued, users },
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    byMonth: Object.entries(monthlyMap).map(([month, reports]) => ({ month, reports })),
    byZone,
  });
}

async function listUsers(_req, res) {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, _count: { select: { reports: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items: users });
}

module.exports = { stats, listUsers };
