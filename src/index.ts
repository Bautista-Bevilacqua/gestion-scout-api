import express from "express";
import cors from "cors";
import helmet from "helmet"; // 🛡️ ESCUDO 1: Oculta vulnerabilidades
import rateLimit from "express-rate-limit"; // 🛡️ ESCUDO 2: Anti Fuerza-Bruta

import beneficiarioRoutes from "./routes/beneficiario.routes.js";
import familiaRoutes from "./routes/familia.routes.js";
import authRoutes from "./routes/auth.routes.js";
import usuariosRoutes from "./routes/usuario.routes.js";
import conceptosRoutes from "./routes/concepto.routes.js";
import cargosRoutes from "./routes/cargo.routes.js";
import cajaRoutes from "./routes/caja.routes.js";
import legajoRoutes from "./routes/legajo.routes.js";
import eventoRoutes from "./routes/evento.routes.js";
import cron from "node-cron";
import { sincronizarPreciosAutomaticamente } from "./services/concepto.service.js";

const app = express();

// --- 1. MIDDLEWARES DE SEGURIDAD BÁSICA ---

// Activa Helmet: Configura cabeceras HTTP seguras automáticamente (previene ataques XSS y clickjacking)
app.use(helmet());

// Cross-Origin Resource Sharing (CORS)
const origenesPermitidos = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_WWW,
  "http://localhost:4200",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (origenesPermitidos.indexOf(origin) === -1) {
        var msg =
          "La política CORS de este sitio no permite acceso desde el origen especificado.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  }),
);

app.use(express.json());

// --- 2. MIDDLEWARES DE RATE LIMITING (Control de tráfico) ---

// Límite GENERAL para toda la API: Máximo 1000 peticiones cada 15 minutos por IP
const limiterGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    message:
      "Demasiadas peticiones desde esta IP. Por favor, esperá un momento.",
  },
});
app.use("/api/", limiterGeneral);

// Límite ESTRICTO solo para el Login: Previene que bots adivinen contraseñas (Fuerza bruta)
// Máximo 10 intentos fallidos cada 15 minutos
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    message:
      "Demasiados intentos de inicio de sesión. Tu IP fue bloqueada por 15 minutos por seguridad.",
  },
});
app.use("/api/auth/login", authLimiter);

// --- 3. RUTAS DE LA API ---

// Agregamos el prefijo /api para que sea profesional
app.use("/api/beneficiarios", beneficiarioRoutes);
app.use("/api/familias", familiaRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/conceptos", conceptosRoutes);
app.use("/api/cargos", cargosRoutes);
app.use("/api/caja", cajaRoutes);
app.use("/api/eventos", eventoRoutes);
app.use("/api/legajos", legajoRoutes);

// (Corregido: le faltaba la "/" antes de api/uploads)
app.use("/api/uploads", express.static("uploads"));

// --- 4. TAREAS PROGRAMADAS (CRON JOBS) ---

cron.schedule("5 0 * * *", async () => {
  console.log("⏰ [CRON] Ejecutando sincronización de precios nocturna...");
  await sincronizarPreciosAutomaticamente();
  console.log("✅ [CRON] Sincronización completada.");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 API Scout corriendo segura en el puerto ${PORT}`);
});
