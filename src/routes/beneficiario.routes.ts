import { Router } from "express";
import {
  getBeneficiarios,
  getBeneficiarioById,
  postBeneficiario,
  putBeneficiario,
  deleteBeneficiario,
  getByFamilia,
  crearRegistroHistorial,
  obtenerHistorial,
} from "../controllers/beneficiario.controller.js";

import { verificarToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verificarToken, getBeneficiarios);
router.get("/:id", verificarToken, getBeneficiarioById);
router.get("/familia/:idFamilia", verificarToken, getByFamilia);
router.post("/", verificarToken, postBeneficiario);
router.put("/:id", verificarToken, putBeneficiario);
router.delete("/:id", verificarToken, deleteBeneficiario);
router.get("/:id/historial", verificarToken, obtenerHistorial);
router.post("/:id/historial", verificarToken, crearRegistroHistorial);

export default router;
