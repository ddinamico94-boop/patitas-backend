const prisma = require("../lib/prisma");

function normalizePhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);

  if (digits.startsWith("381")) return `549${digits}`;

  return digits;
}

async function pending(req, res) {
  const now = new Date();
  const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

  const items = await prisma.report.findMany({
    where: {
      whatsappFollowupConsent: true,
      status: { in: ["perdido", "en_adopcion"] },
      phone: { not: "" },
      OR: [
        { whatsappFollowupLastSentAt: null },
        { whatsappFollowupLastSentAt: { lte: fourDaysAgo } },
      ],
      AND: [{
        OR: [
          { whatsappFollowupReservedUntil: null },
          { whatsappFollowupReservedUntil: { lt: now } },
        ],
      }],
    },
    select: {
      id: true,
      name: true,
      status: true,
      phone: true,
    },
  });

  res.json({ items });
}

async function reserve(req, res) {
  const { reportId } = req.body;

  if (typeof reportId !== "string" || !reportId.trim()) {
    return res.status(400).json({ error: "Falta reportId." });
  }

  const now = new Date();
  const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
  const reservedUntil = new Date(now.getTime() + 10 * 60 * 1000);

  const result = await prisma.report.updateMany({
    where: {
      id: reportId,
      whatsappFollowupConsent: true,
      status: { in: ["perdido", "en_adopcion"] },
      phone: { not: "" },
      OR: [
        { whatsappFollowupLastSentAt: null },
        { whatsappFollowupLastSentAt: { lte: fourDaysAgo } },
      ],
      AND: [{
        OR: [
          { whatsappFollowupReservedUntil: null },
          { whatsappFollowupReservedUntil: { lt: now } },
        ],
      }],
    },
    data: {
      whatsappFollowupReservedUntil: reservedUntil,
    },
  });

  if (result.count === 0) {
    return res.status(409).json({
      reserved: false,
      error: "El reporte no está disponible para seguimiento.",
    });
  }

  res.json({ reserved: true, reservedUntil });
}

async function unsubscribe(req, res) {
  const { phone } = req.body;

  if (typeof phone !== "string" || !phone.trim()) {
    return res.status(400).json({ ok: false, error: "Falta el teléfono." });
  }

  const normalizedPhone = normalizePhone(phone);

  const reports = await prisma.report.findMany({
    where: {
      whatsappFollowupConsent: true,
    },
    select: {
      id: true,
      phone: true,
    },
  });

  const matchingIds = reports
    .filter((report) => normalizePhone(report.phone) === normalizedPhone)
    .map((report) => report.id);

  if (matchingIds.length === 0) {
    return res.json({ ok: true, updated: 0 });
  }

  const result = await prisma.report.updateMany({
    where: {
      id: { in: matchingIds },
      whatsappFollowupConsent: true,
    },
    data: {
      whatsappFollowupConsent: false,
      whatsappFollowupReservedUntil: null,
    },
  });

  res.json({ ok: true, updated: result.count });
}


async function sent(req, res) {
  const { reportId } = req.body;

  if (typeof reportId !== "string" || !reportId.trim()) {
    return res.status(400).json({ ok: false, error: "Falta reportId." });
  }

  const now = new Date();

  const result = await prisma.report.updateMany({
    where: {
      id: reportId,
      whatsappFollowupConsent: true,
      status: { in: ["perdido", "en_adopcion"] },
      whatsappFollowupReservedUntil: { gt: now },
    },
    data: {
      whatsappFollowupLastSentAt: now,
      whatsappFollowupReservedUntil: null,
    },
  });

  if (result.count === 0) {
    return res.status(409).json({
      ok: false,
      error: "No se pudo confirmar el envío: reserva inexistente o reporte no elegible.",
    });
  }

  res.json({ ok: true, sent: true });
}

async function release(req, res) {
  const { reportId } = req.body;

  if (typeof reportId !== "string" || !reportId.trim()) {
    return res.status(400).json({ ok: false, error: "Falta reportId." });
  }

  const result = await prisma.report.updateMany({
    where: {
      id: reportId,
      whatsappFollowupConsent: true,
      status: { in: ["perdido", "en_adopcion"] },
      whatsappFollowupReservedUntil: { not: null },
    },
    data: {
      whatsappFollowupReservedUntil: null,
    },
  });

  res.json({ ok: true, released: result.count > 0 });
}
module.exports = { pending, reserve, unsubscribe, sent, release };


