const { z } = require('zod');
const prisma = require('../lib/prisma');

// ======================================================
// ENUMS
// ======================================================

const AnimalType = z.enum([
  'perro',
  'gato',
  'otro',
]);

const AnimalStatus = z.enum([
  'perdido',
  'encontrado',
  'en_calle',
  'ayudado',
  'rescatado',
  'maltrato',
  'en_adopcion',
  'adoptado',
]);


const AnimalSex = z.enum([
  'macho',
  'hembra',
]);

// ======================================================
// VALIDACIONES
// ======================================================

const createReportSchema = z.object({
  name: z
    .string()
    .min(
      1,
      'El nombre del animal es obligatorio'
    ),

  type: AnimalType,

  status: AnimalStatus.default(
    'perdido'
  ),

  zone: z
    .string()
    .min(
      1,
      'La zona es obligatoria'
    ),

  address: z
    .string()
    .optional(),

  description: z
    .string()
    .optional(),

  breed: z
    .string()
    .optional(),

  color: z
    .string()
    .optional(),

  size: z
    .string()
    .optional(),

  // ==========================================
  // DATOS PARA ADOPCIÓN
  // ==========================================

  sex: AnimalSex.optional(),

  age: z
    .string()
    .optional(),

  // ==========================================

  contactName: z
    .string()
    .min(
      1,
      'El nombre de contacto es obligatorio'
    ),

  phone: z
    .string()
    .min(
      1,
      'El teléfono es obligatorio'
    ),

  email: z
    .string()
    .email(
      'Email de contacto inválido'
    ),

  mapLat: z
    .number()
    .optional(),

  mapLng: z
    .number()
    .optional(),

  images: z
    .array(
      z.string().url()
    )
    .optional()
    .default([]),
});

const updateReportSchema =
  createReportSchema.partial();

// ======================================================
// QUERY DE LISTADO
// ======================================================

const listQuerySchema = z.object({
  status:
    AnimalStatus.optional(),

  type:
    AnimalType.optional(),

  zone:
    z.string().optional(),

  search:
    z.string().optional(),

  page:
    z.coerce
      .number()
      .int()
      .min(1)
      .default(1),

  pageSize:
    z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .default(12),
});

// ======================================================
// INCLUDE
// ======================================================

const reportInclude = {
  images: {
    orderBy: {
      order: 'asc',
    },
  },
};

// ======================================================
// LISTAR REPORTES
// ======================================================

async function list(req, res) {
  const q =
    listQuerySchema.parse(
      req.query
    );

  const where = {
    ...(q.status && {
      status: q.status,
    }),

    ...(q.type && {
      type: q.type,
    }),

    ...(q.zone && {
      zone: q.zone,
    }),

    ...(q.search && {
      OR: [
        {
          name: {
            contains: q.search,
            mode: 'insensitive',
          },
        },

        {
          breed: {
            contains: q.search,
            mode: 'insensitive',
          },
        },

        {
          description: {
            contains: q.search,
            mode: 'insensitive',
          },
        },

        {
          zone: {
            contains: q.search,
            mode: 'insensitive',
          },
        },
      ],
    }),
  };

  const [
    items,
    total,
  ] =
    await Promise.all([
      prisma.report.findMany({
        where,

        include:
          reportInclude,

        orderBy: {
          createdAt: 'desc',
        },

        skip:
          (q.page - 1) *
          q.pageSize,

        take:
          q.pageSize,
      }),

      prisma.report.count({
        where,
      }),
    ]);

  res.json({
    items,
    total,
    page: q.page,
    pageSize:
      q.pageSize,

    totalPages:
      Math.ceil(
        total /
          q.pageSize
      ),
  });
}

// ======================================================
// OBTENER REPORTE
// ======================================================

async function getById(req, res) {
  const report =
    await prisma.report.findUnique({
      where: {
        id: req.params.id,
      },

      include:
        reportInclude,
    });

  if (!report) {
    return res
      .status(404)
      .json({
        error:
          'Reporte no encontrado.',
      });
  }

  res.json({
    report,
  });
}

// ======================================================
// CREAR REPORTE
// ======================================================

async function create(req, res) {
  const data =
    createReportSchema.parse(
      req.body
    );

  const {
    images,
    ...rest
  } = data;

  const report =
    await prisma.report.create({
      data: {
        ...rest,

        userId:
          req.user?.id,

        images: {
          create:
            images.map(
              (
                url,
                order
              ) => ({
                url,
                order,
              })
            ),
        },
      },

      include:
        reportInclude,
    });

  res
    .status(201)
    .json({
      report,
    });
}

// ======================================================
// ACTUALIZAR REPORTE
// ======================================================

async function update(req, res) {
  const existing =
    await prisma.report.findUnique({
      where: {
        id: req.params.id,
      },
    });

  if (!existing) {
    return res
      .status(404)
      .json({
        error:
          'Reporte no encontrado.',
      });
  }

  const isOwner =
    existing.userId ===
    req.user.id;

  const isAdmin =
    req.user.role ===
    'ADMIN';

  if (
    !isOwner &&
    !isAdmin
  ) {
    return res
      .status(403)
      .json({
        error:
          'No podés editar un reporte que no es tuyo.',
      });
  }

  const data =
    updateReportSchema.parse(
      req.body
    );

  const {
    images,
    ...rest
  } = data;

  const report =
    await prisma.report.update({
      where: {
        id: req.params.id,
      },

      data: {
        ...rest,

        ...(images && {
          images: {
            deleteMany: {},

            create:
              images.map(
                (
                  url,
                  order
                ) => ({
                  url,
                  order,
                })
              ),
          },
        }),
      },

      include:
        reportInclude,
    });

  res.json({
    report,
  });
}

// ======================================================
// ELIMINAR REPORTE
// ======================================================

async function remove(req, res) {
  const existing =
    await prisma.report.findUnique({
      where: {
        id: req.params.id,
      },
    });

  if (!existing) {
    return res
      .status(404)
      .json({
        error:
          'Reporte no encontrado.',
      });
  }

  const isOwner =
    existing.userId ===
    req.user.id;

  const isAdmin =
    req.user.role ===
    'ADMIN';

  if (
    !isOwner &&
    !isAdmin
  ) {
    return res
      .status(403)
      .json({
        error:
          'No podés borrar un reporte que no es tuyo.',
      });
  }

  await prisma.report.delete({
    where: {
      id: req.params.id,
    },
  });

  res
    .status(204)
    .send();
}

// ======================================================
// MIS REPORTES
// ======================================================

async function myReports(
  req,
  res
) {
  const items =
    await prisma.report.findMany({
      where: {
        userId:
          req.user.id,
      },

      include:
        reportInclude,

      orderBy: {
        createdAt: 'desc',
      },
    });

  res.json({
    items,
  });
}

// ======================================================
// SITEMAP
// ======================================================

async function sitemap(
  req,
  res
) {
  const reports =
    await prisma.report.findMany({
      select: {
        id: true,
        createdAt: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

  const baseUrl =
    'https://www.patitastucuman.com';

  const reportUrls =
    reports
      .map(
        (report) => `
  <url>
    <loc>${baseUrl}/reporte/${encodeURIComponent(
      report.id
    )}</loc>
    <lastmod>${report.createdAt.toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`
      )
      .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <url>
    <loc>${baseUrl}/reportes</loc>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>

  <url>
    <loc>${baseUrl}/adoptar</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>

  <url>
    <loc>${baseUrl}/mapa</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>

  <url>
    <loc>${baseUrl}/crear-reporte</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>

${reportUrls}

</urlset>`;

  res.setHeader(
    'Content-Type',
    'application/xml; charset=utf-8'
  );

  res
    .status(200)
    .send(xml);
}

// ======================================================
// ESCAPAR HTML
// ======================================================

function escapeHtml(
  value = ''
) {
  return String(value)
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}

// ======================================================
// PREVIEW PARA COMPARTIR
// ======================================================

async function sharePreview(
  req,
  res
) {
  const report =
    await prisma.report.findUnique({
      where: {
        id: req.params.id,
      },

      include:
        reportInclude,
    });

  if (!report) {
    return res
      .status(404)
      .send(
        'Reporte no encontrado'
      );
  }

  const statusLabels = {
    perdido:
      'Perdido',

    encontrado:
      'Encontrado',

    en_calle:
      'En situación de calle',

    ayudado:
      'Ayudado',

    rescatado:
      'Rescatado',

    en_adopcion:
      'En adopción',

    adoptado:
      'Adoptado',

    maltrato: 
      'Maltrato animal',
  };

  const status =
    statusLabels[
      report.status
    ] ||
    report.status;

  const reportUrl =
    `https://www.patitastucuman.com/reporte/${encodeURIComponent(
      report.id
    )}`;

  const image =
    report.images?.[0]
      ?.url ||
    'https://www.patitastucuman.com/og-image.png';

  // Para adopciones hacemos el título
  // un poco más natural.
  const title =
    report.status ===
    'en_adopcion'
      ? `${report.name} busca una familia | Patitas Tucumán`
      : report.status ===
          'adoptado'
        ? `${report.name} fue adoptado | Patitas Tucumán`
        : `${report.name} - ${status} en ${report.zone} | Patitas Tucumán`;

  const description =
    report.description ||
    (
      report.status ===
      'en_adopcion'
        ? `${report.name} está en adopción en ${report.zone}, Tucumán. Conocé su historia y ayudalo a encontrar una familia.`
        : report.status ===
            'adoptado'
          ? `${report.name} encontró una familia en Tucumán.`
          : `${report.name} fue reportado como ${status.toLowerCase()} en ${report.zone}, Tucumán. Ayudanos a difundir.`
    );

  const safeTitle =
    escapeHtml(title);

  const safeDescription =
    escapeHtml(
      description
    );

  const safeImage =
    escapeHtml(image);

  const safeReportUrl =
    escapeHtml(
      reportUrl
    );

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />

  <title>
    ${safeTitle}
  </title>

  <meta
    name="description"
    content="${safeDescription}"
  />

  <link
    rel="canonical"
    href="${safeReportUrl}"
  />

  <meta
    property="og:type"
    content="article"
  />

  <meta
    property="og:site_name"
    content="Patitas Tucumán"
  />

  <meta
    property="og:title"
    content="${safeTitle}"
  />

  <meta
    property="og:description"
    content="${safeDescription}"
  />

  <meta
    property="og:image"
    content="${safeImage}"
  />

  <meta
    property="og:url"
    content="${safeReportUrl}"
  />

  <meta
    name="twitter:card"
    content="summary_large_image"
  />

  <meta
    name="twitter:title"
    content="${safeTitle}"
  />

  <meta
    name="twitter:description"
    content="${safeDescription}"
  />

  <meta
    name="twitter:image"
    content="${safeImage}"
  />

  <meta
    http-equiv="refresh"
    content="0;url=${safeReportUrl}"
  />
</head>

<body>

  <p>
    Redirigiendo a

    <a
      href="${safeReportUrl}"
    >
      ${safeTitle}
    </a>
  </p>

</body>
</html>`;

  res
    .status(200)
    .set(
      'Content-Type',
      'text/html; charset=utf-8'
    )
    .send(html);
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  myReports,
  sitemap,
  sharePreview,
};