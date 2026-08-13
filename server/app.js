require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

const API_VERSION = process.env.API_VERSION || "v1";

// 1. Estructura de directorios uploads
const subfolders = ["avatars", "restaurant", "product", "dishes", "news"];
subfolders.forEach((folder) => {
  const dirPath = path.join(__dirname, "uploads", folder);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// 2. Importar rutas
const authRoutes = require("./router/auth");
const userRoutes = require("./router/user");
const productRoutes = require("./router/product");
const restaurantRoutes = require("./router/restaurant");
const orderRoutes = require("./router/order");
const newsRoutes = require("./router/news");
const driverRoutes = require("./router/driver");
const contactRoutes = require("./router/contact");
const clientRoutes = require("./router/client");
const dishRoutes = require("./router/dish");

// 3. Middlewares Globales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:3977",
      "https://frontend-rappi.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
  })
);

// 4. Archivos estáticos
app.use(
  "/uploads",
  (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "uploads"))
);

// 5. Registro de rutas
const apiRoutes = [
  authRoutes,
  userRoutes,
  productRoutes,
  restaurantRoutes,
  orderRoutes,
  newsRoutes,
  driverRoutes,
  contactRoutes,
  clientRoutes,
  dishRoutes,
];

apiRoutes.forEach((route) => {
  if (route) {
    app.use(`/api/${API_VERSION}`, route);
    app.use("/api", route);
  }
});

// 6. Ruta 404 No Encontrada
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    msg: `La ruta '${req.originalUrl}' no fue encontrada en el servidor.`,
  });
});

// 7. Manejo de Errores Global
app.use((err, req, res, next) => {
  console.error("🔥 Error no controlado:", err.stack || err);
  res.status(500).json({
    status: "error",
    msg: "Ocurrió un error interno en el servidor.",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

module.exports = app;