const { v2: cloudinary } = require('cloudinary');

function configure() {
  const names = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  if (names.some((name) => !process.env[name]?.trim())) {
    const error = new Error('Falta configurar Cloudinary en las variables de entorno del backend.');
    error.status = 503;
    throw error;
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
    secure: true,
  });
}

async function uploadImage(buffer) {
  configure();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      resource_type: 'image',
      folder: 'patitas/reportes',
      // Reduce dimensiones y peso de la copia almacenada, sin recortar.
      transformation: [{ width: 1200, height: 1200, crop: 'limit' }, { quality: 'auto:good' }],
      format: 'webp',
      timeout: 60000,
    }, (error, result) => {
      if (error || !result?.secure_url || !result?.public_id) {
        const failure = new Error('No se pudo subir la foto a Cloudinary. Revisá las credenciales y el uso de tu cuenta.');
        failure.status = 502;
        return reject(failure);
      }
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
    stream.on('error', () => {
      const error = new Error('Se interrumpió la subida de la foto. Intentá nuevamente.');
      error.status = 502;
      reject(error);
    });
    stream.end(buffer);
  });
}

async function deleteImage(publicId) {
  configure();
  return cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}

module.exports = { uploadImage, deleteImage };
