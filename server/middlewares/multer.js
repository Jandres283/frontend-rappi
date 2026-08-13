const multer = require("multer");

// Usamos almacenamiento en memoria temporal para evitar errores de permisos de disco en Render
const storage = multer.memoryStorage();

// Filtro para validar formatos de imágenes
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  if (file.mimetype && allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Formato de archivo no soportado. Solo se permiten imágenes (JPG, PNG, WEBP, GIF)."
      ),
      false
    );
  }
};

// Middleware reutilizable
const upload = (folder) =>
  multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024, // Máximo 5 MB
    },
  });

module.exports = upload;