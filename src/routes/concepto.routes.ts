import { Router } from "express";
import {
  getAll,
  create,
  remove,
  asignar,
  getDisponibles,
  createMasivo,
  actualizarPrecio,
  archivarPagados,
  archivarIndividual,
} from "../controllers/concepto.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

const router = Router();

// Todas las rutas protegidas
router.get("/", verificarToken, getAll);
router.post("/", verificarToken, create);
router.post("/:id/asignar", verificarToken, asignar); // <-- NUEVA RUTA
router.get("/disponibles/:idBeneficiario", verificarToken, getDisponibles);
router.post("/masivo", verificarToken, createMasivo);
router.delete("/:id", verificarToken, remove);
router.put("/actualizar-precio/:id", verificarToken, actualizarPrecio);
router.put("/archivar-pagados", verificarToken, archivarPagados);
router.put("/:id/archivar", verificarToken, archivarIndividual);
export default router;
