import { Router } from "express";
import {
  getMovimientosCaja,
  crearMovimientoManual,
} from "../controllers/caja.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

const router = Router();

// GET /api/caja (Acepta query params: ?fechaDesde=...&fechaHasta=...)
router.get("/", verificarToken, getMovimientosCaja);

// POST /api/caja/manual (Para cargar compras o ingresos extra)
router.post("/manual", verificarToken, crearMovimientoManual);

export default router;
