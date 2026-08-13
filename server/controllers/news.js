const News = require("../models/news");
const cloudinary = require("cloudinary").v2;

// Configuración de Cloudinary usando tus variables del .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Función auxiliar para subir imágenes a Cloudinary desde memoria
const uploadToCloudinary = (fileBuffer, folderName = "news") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: folderName },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(fileBuffer);
  });
};

// OBTENER NOTICIAS
async function getNews(req, res) {
  try {
    const { page, limit } = req.query;

    if (page || limit) {
      const options = {
        page: parseInt(page || 1, 10),
        limit: parseInt(limit || 100, 10),
        sort: { createdAt: -1 },
      };

      const newsPaginated = await News.paginate({}, options);

      if (newsPaginated && newsPaginated.docs) {
        newsPaginated.docs = newsPaginated.docs.map((doc) => {
          const item = doc.toObject ? doc.toObject() : doc;
          return { ...item, id: item._id.toString() };
        });
      }

      return res.status(200).json(newsPaginated);
    }

    const newsList = await News.find().sort({ createdAt: -1 }).lean();

    const formattedNews = newsList.map((item) => ({
      ...item,
      id: item._id.toString(),
    }));

    return res.status(200).json(formattedNews);
  } catch (error) {
    console.error("🔥 Error al obtener noticias:", error);
    return res.status(500).json({ msg: "Error al consultar la base de datos." });
  }
}

// OBTENER UNA NOTICIA POR ID
async function getOneNews(req, res) {
  try {
    const { id } = req.params;
    const newsItem = await News.findById(id).lean();

    if (!newsItem) {
      return res.status(404).json({ msg: "Noticia no encontrada." });
    }

    return res.status(200).json({
      ...newsItem,
      id: newsItem._id.toString(),
    });
  } catch (error) {
    console.error("🔥 Error al buscar la noticia:", error);
    return res.status(500).json({ msg: "Error al buscar la noticia." });
  }
}

// CREAR NOTICIA
async function createNews(req, res) {
  try {
    console.log("📥 Body recibido:", req.body);
    console.log("📷 Archivo recibido:", req.file ? req.file.originalname : "Sin archivo");

    const newsData = { ...req.body };

    if (!newsData.content && newsData.description) {
      newsData.content = newsData.description;
    }

    if (newsData.active !== undefined) {
      newsData.active = newsData.active === "true" || newsData.active === true;
    }

    if (newsData.isFeatured !== undefined) {
      newsData.isFeatured = newsData.isFeatured === "true" || newsData.isFeatured === true;
    }

    if (req.user) {
      newsData.user =
        req.user.user_id ||
        req.user.id ||
        req.user._id ||
        req.user.sub;
    }

    // Subir imagen a Cloudinary si existe el archivo
    if (req.file) {
      try {
        const imageUrl = await uploadToCloudinary(req.file.buffer, "news");
        newsData.miniature = imageUrl;
      } catch (uploadErr) {
        console.error("⚠️ Error subiendo a Cloudinary, usando fallback Base64:", uploadErr);
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        newsData.miniature = `data:${req.file.mimetype};base64,${b64}`;
      }
    }

    const news = new News(newsData);
    const newsStored = await news.save();

    console.log("✅ Noticia guardada con éxito en Mongo:", newsStored);

    const result = newsStored.toObject();
    return res.status(201).json({
      ...result,
      id: result._id.toString(),
    });
  } catch (error) {
    console.error("🔥 Error Mongoose al crear noticia:", error);
    return res.status(400).json({
      msg: "Error al guardar la noticia en la base de datos.",
      error: error.message,
    });
  }
}

// ACTUALIZAR NOTICIA
async function updateNews(req, res) {
  try {
    const { id } = req.params;
    const newsData = { ...req.body };

    if (!newsData.content && newsData.description) {
      newsData.content = newsData.description;
    }

    if (newsData.active !== undefined) {
      newsData.active = newsData.active === "true" || newsData.active === true;
    }

    if (newsData.isFeatured !== undefined) {
      newsData.isFeatured = newsData.isFeatured === "true" || newsData.isFeatured === true;
    }

    if (req.file) {
      try {
        const imageUrl = await uploadToCloudinary(req.file.buffer, "news");
        newsData.miniature = imageUrl;
      } catch (uploadErr) {
        console.error("⚠️ Error subiendo a Cloudinary:", uploadErr);
      }
    }

    const newsUpdated = await News.findByIdAndUpdate(id, newsData, {
      new: true,
      runValidators: true,
    }).lean();

    if (!newsUpdated) {
      return res.status(404).json({ msg: "No se encontró la noticia a actualizar." });
    }

    return res.status(200).json({
      ...newsUpdated,
      id: newsUpdated._id.toString(),
    });
  } catch (error) {
    console.error("🔥 Error al actualizar noticia:", error);
    return res.status(500).json({
      msg: "Error interno al actualizar la noticia.",
      error: error.message,
    });
  }
}

// ELIMINAR NOTICIA
async function deleteNews(req, res) {
  try {
    const { id } = req.params;
    const newsDeleted = await News.findByIdAndDelete(id);

    if (!newsDeleted) {
      return res.status(404).json({ msg: "La noticia no existe o ya fue eliminada." });
    }

    return res.status(200).json({ msg: "Noticia eliminada correctamente." });
  } catch (error) {
    console.error("🔥 Error al eliminar noticia:", error);
    return res.status(500).json({ msg: "Error al eliminar la noticia." });
  }
}

module.exports = {
  getNews,
  getOneNews,
  createNews,
  updateNews,
  deleteNews,
};