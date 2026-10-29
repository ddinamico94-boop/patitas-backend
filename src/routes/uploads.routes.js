const { Router } = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { uploadImage, deleteImage } = require('../lib/cloudinary');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB por foto
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten archivos de imagen.'));
    }
    cb(null, true);
  },
});

const router = Router();

// Sube hasta 10 fotos y devuelve sus URLs públicas
router.post('/', requireAuth, upload.array('images', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No se recibieron archivos.' });
  }

  const uploaded = [];
  try {
    // Secuencial: conserva el orden y limita las subidas simultáneas.
    for (const file of req.files) {
      uploaded.push(await uploadImage(file.buffer));
    }
    res.status(201).json({ urls: uploaded.map((image) => image.url) });
  } catch (error) {
    // Si falla el lote, evita dejar las fotos anteriores consumiendo cuota.
    await Promise.allSettled(uploaded.map((image) => deleteImage(image.publicId)));
    throw error;
  }
});

module.exports = router;
