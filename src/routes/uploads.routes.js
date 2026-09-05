const { Router } = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { uploadImage } = require('../lib/supabase');

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

  const urls = await Promise.all(
    req.files.map((file) => uploadImage(file.buffer, file.originalname, file.mimetype))
  );

  res.status(201).json({ urls });
});

module.exports = router;
