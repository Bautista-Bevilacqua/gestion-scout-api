import express from "express";
import cors from "cors";
import beneficiarioRoutes from "./routes/beneficiario.routes.js";

const app = express();
app.use(cors());
app.use(express.json());

// Agregamos el prefijo /api para que sea profesional
app.use("/api/beneficiarios", beneficiarioRoutes);

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 API Scout en puerto ${PORT}`));
