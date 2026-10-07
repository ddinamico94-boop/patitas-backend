const express = require('express');

const prisma = require('../lib/prisma');
const {
  requireAuth,
  requireAdmin,
} = require('../middleware/auth');
const { emitAdmin } = require('../lib/socket');

const router = express.Router();

/*
 * ============================================================
 * CONSULTAS PÚBLICAS
 * ============================================================
 */

/**
 * Obtener quirófanos móviles activos.
 *
 * Esta ruta sigue siendo pública porque la página principal
 * necesita mostrar la información sin que el visitante tenga
 * que iniciar sesión.
 */
router.get('/', async (req, res) => {
  try {
    const ahora = new Date();

    const quirofanos =
      await prisma.quirofanoMovil.findMany({
        where: {
          activo: true,
          fechaFin: {
            gte: ahora,
          },
        },
        orderBy: {
          fechaInicio: 'asc',
        },
      });

    res.json(quirofanos);
  } catch (error) {
    console.error(
      'Error obteniendo quirófanos:',
      error
    );

    res.status(500).json({
      error:
        'No se pudieron obtener los quirófanos móviles',
    });
  }
});

/**
 * Obtener un quirófano por ID.
 *
 * También es público.
 */
router.get('/:id', async (req, res) => {
  try {
    const quirofano =
      await prisma.quirofanoMovil.findUnique({
        where: {
          id: req.params.id,
        },
      });

    if (!quirofano) {
      return res.status(404).json({
        error:
          'Quirófano móvil no encontrado',
      });
    }

    res.json(quirofano);
  } catch (error) {
    console.error(
      'Error obteniendo quirófano:',
      error
    );

    res.status(500).json({
      error:
        'No se pudo obtener el quirófano móvil',
    });
  }
});

/*
 * ============================================================
 * CREAR
 * ============================================================
 *
 * Solo ADMIN.
 */
router.post(
  '/',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const {
        nombre,
        direccion,
        barrio,
        lat,
        lng,
        fechaInicio,
        fechaFin,
        horario,
        informacion,
        activo,
      } = req.body;

      if (!direccion) {
        return res.status(400).json({
          error:
            'La dirección es obligatoria',
        });
      }

      if (
        lat === undefined ||
        lng === undefined
      ) {
        return res.status(400).json({
          error:
            'La ubicación en el mapa es obligatoria',
        });
      }

      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({
          error:
            'Las fechas son obligatorias',
        });
      }

      const inicio =
        new Date(fechaInicio);

      const fin =
        new Date(fechaFin);

      if (
        Number.isNaN(
          inicio.getTime()
        ) ||
        Number.isNaN(
          fin.getTime()
        )
      ) {
        return res.status(400).json({
          error:
            'Las fechas no son válidas',
        });
      }

      if (fin < inicio) {
        return res.status(400).json({
          error:
            'La fecha de finalización no puede ser anterior a la fecha de inicio',
        });
      }

      const quirofano =
        await prisma.quirofanoMovil.create({
          data: {
            nombre:
              nombre ||
              'Quirófano Móvil',

            direccion,

            barrio:
              barrio || null,

            lat: Number(lat),

            lng: Number(lng),

            fechaInicio: inicio,

            fechaFin: fin,

            horario:
              horario || null,

            informacion:
              informacion || null,

            activo:
              activo !== undefined
                ? Boolean(activo)
                : true,
          },
        });

      // Avisamos a todos los administradores
      emitAdmin(
        'quirofano:created',
        quirofano
      );

      // También avisamos que el contenido público cambió
      emitAdmin(
        'public:data-updated',
        {
          type: 'quirofano',
          action: 'created',
          item: quirofano,
        }
      );

      res.status(201).json(
        quirofano
      );
    } catch (error) {
      console.error(
        'Error creando quirófano:',
        error
      );

      res.status(500).json({
        error:
          'No se pudo crear el quirófano móvil',
      });
    }
  }
);

/*
 * ============================================================
 * ACTUALIZAR
 * ============================================================
 *
 * Solo ADMIN.
 */
router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const existente =
        await prisma.quirofanoMovil.findUnique({
          where: {
            id: req.params.id,
          },
        });

      if (!existente) {
        return res.status(404).json({
          error:
            'Quirófano móvil no encontrado',
        });
      }

      const {
        nombre,
        direccion,
        barrio,
        lat,
        lng,
        fechaInicio,
        fechaFin,
        horario,
        informacion,
        activo,
      } = req.body;

      const data = {};

      if (nombre !== undefined) {
        data.nombre = nombre;
      }

      if (direccion !== undefined) {
        data.direccion = direccion;
      }

      if (barrio !== undefined) {
        data.barrio =
          barrio || null;
      }

      if (lat !== undefined) {
        data.lat = Number(lat);
      }

      if (lng !== undefined) {
        data.lng = Number(lng);
      }

      if (horario !== undefined) {
        data.horario =
          horario || null;
      }

      if (
        informacion !== undefined
      ) {
        data.informacion =
          informacion || null;
      }

      if (activo !== undefined) {
        data.activo =
          Boolean(activo);
      }

      if (
        fechaInicio !== undefined
      ) {
        const inicio =
          new Date(fechaInicio);

        if (
          Number.isNaN(
            inicio.getTime()
          )
        ) {
          return res.status(400).json({
            error:
              'La fecha de inicio no es válida',
          });
        }

        data.fechaInicio = inicio;
      }

      if (
        fechaFin !== undefined
      ) {
        const fin =
          new Date(fechaFin);

        if (
          Number.isNaN(
            fin.getTime()
          )
        ) {
          return res.status(400).json({
            error:
              'La fecha de finalización no es válida',
          });
        }

        data.fechaFin = fin;
      }

      const inicioFinal =
        data.fechaInicio ||
        existente.fechaInicio;

      const finFinal =
        data.fechaFin ||
        existente.fechaFin;

      if (finFinal < inicioFinal) {
        return res.status(400).json({
          error:
            'La fecha de finalización no puede ser anterior a la fecha de inicio',
        });
      }

      const actualizado =
        await prisma.quirofanoMovil.update({
          where: {
            id: req.params.id,
          },
          data,
        });

      // Avisamos a los administradores
      emitAdmin(
        'quirofano:updated',
        actualizado
      );

      // Avisamos que los datos públicos cambiaron
      emitAdmin(
        'public:data-updated',
        {
          type: 'quirofano',
          action: 'updated',
          item: actualizado,
        }
      );

      res.json(
        actualizado
      );
    } catch (error) {
      console.error(
        'Error actualizando quirófano:',
        error
      );

      res.status(500).json({
        error:
          'No se pudo actualizar el quirófano móvil',
      });
    }
  }
);

/*
 * ============================================================
 * ELIMINAR
 * ============================================================
 *
 * Solo ADMIN.
 */
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const existente =
        await prisma.quirofanoMovil.findUnique({
          where: {
            id: req.params.id,
          },
        });

      if (!existente) {
        return res.status(404).json({
          error:
            'Quirófano móvil no encontrado',
        });
      }

      await prisma.quirofanoMovil.delete({
        where: {
          id: req.params.id,
        },
      });

      // Avisamos a los administradores
      emitAdmin(
        'quirofano:deleted',
        {
          id: existente.id,
        }
      );

      // Avisamos que los datos públicos cambiaron
      emitAdmin(
        'public:data-updated',
        {
          type: 'quirofano',
          action: 'deleted',
          item: existente,
        }
      );

      res.json({
        ok: true,
        message:
          'Quirófano móvil eliminado correctamente',
      });
    } catch (error) {
      console.error(
        'Error eliminando quirófano:',
        error
      );

      res.status(500).json({
        error:
          'No se pudo eliminar el quirófano móvil',
      });
    }
  }
);

module.exports = router;