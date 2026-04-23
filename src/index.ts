import express from "express";
import cors from "cors";
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
app.use(cors());
app.use(express.json());

// Agregamos el prefijo /api para que sea profesional
app.use("/api/beneficiarios", beneficiarioRoutes);
app.use("/api/familias", familiaRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/conceptos", conceptosRoutes);
app.use("/api/cargos", cargosRoutes);
app.use("/api/caja", cajaRoutes);
app.use("/api/eventos", eventoRoutes);

app.use("api/uploads", express.static("uploads"));

app.use("/api/legajos", legajoRoutes);

cron.schedule("* * * * *", async () => {
  console.log("⏰ [TEST] El cron se despertó. Revisando precios...");
  await sincronizarPreciosAutomaticamente();
  console.log("✅ [TEST] Revisión terminada.");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 API Scout corriendo en el puerto ${PORT}`);
});
