const express = require("express");
const NewsController = require("../controllers/news");
const { ensureAuth } = require("../middlewares/authenticated");
const { isAdmin } = require("../middlewares/isRole");
const upload = require("../middlewares/multer");

const api = express.Router();

// 🟢 RUTAS PÚBLICAS (Lectura)
api.get("/news", NewsController.getNews);
api.get("/news/:id", NewsController.getOneNews);

// 🟢 CREAR NOTICIA
// 1° Valida Token -> 2° Valida Rol Admin -> 3° Procesa Imagen FormData
api.post(
  "/news",
  [
    ensureAuth,
    isAdmin,
    upload("news").single("miniature"),
  ],
  NewsController.createNews
);

// 🟢 ACTUALIZAR NOTICIA
api.patch(
  "/news/:id",
  [
    ensureAuth,
    isAdmin,
    upload("news").single("miniature"),
  ],
  NewsController.updateNews
);

// 🟢 ELIMINAR NOTICIA
api.delete(
  "/news/:id",
  [ensureAuth, isAdmin],
  NewsController.deleteNews
);

module.exports = api;