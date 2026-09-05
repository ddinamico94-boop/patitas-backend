const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BUCKET = process.env.SUPABASE_BUCKET || 'patitas-fotos';

/**
 * Sube un buffer de imagen a Supabase Storage y devuelve la URL pública.
 * @param {Buffer} buffer
 * @param {string} originalName
 * @param {string} mimetype
 */
async function uploadImage(buffer, originalName, mimetype) {
  const ext = originalName.split('.').pop();
  const fileName = `reportes/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(fileName, buffer, {
    contentType: mimetype,
    upsert: false,
  });

  if (error) throw new Error(`Error subiendo imagen: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

module.exports = { uploadImage };
