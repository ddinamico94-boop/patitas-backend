const { v2: cloudinary } = require("cloudinary")

function configure() {
  const names = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ]
  if (names.some((name) => !process.env[name]?.trim())) {
    const error = new Error(
      "Falta configurar Cloudinary en las variables de entorno del backend.",
    )
    error.status = 503
    throw error
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
    secure: true,
  })
}

async function uploadImage(buffer) {
  configure()

  return new Promise((resolve, reject) => {
    let settled = false

    function fail(message, details, status = 502) {
      if (settled) return
      settled = true

      console.error(message, details)

      const failure = new Error(
        "No se pudo subir la foto a Cloudinary. Revisá las credenciales y el uso de tu cuenta.",
      )
      failure.status = status
      reject(failure)
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: "patitas/reportes",
        transformation: [
          { width: 1200, height: 1200, crop: "limit" },
          { quality: "auto:good" },
        ],
        format: "webp",
        timeout: 60000,
      },
      (error, result) => {
        if (error || !result?.secure_url || !result?.public_id) {
          return fail("Error de Cloudinary al subir imagen:", {
            message:
              error?.message || "Cloudinary no devolvió una URL o public_id.",
            name: error?.name,
            http_code: error?.http_code,
            code: error?.code,
          })
        }

        if (settled) return
        settled = true

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        })
      },
    )

    stream.on("error", (streamError) => {
      fail("Error en el stream de subida a Cloudinary:", {
        message: streamError?.message,
        name: streamError?.name,
        code: streamError?.code,
      })
    })

    stream.end(buffer)
  })
}

async function deleteImage(publicId) {
  configure()
  return cloudinary.uploader.destroy(publicId, { resource_type: "image" })
}

module.exports = { uploadImage, deleteImage }
