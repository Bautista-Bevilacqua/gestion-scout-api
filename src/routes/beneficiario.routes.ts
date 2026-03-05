import { Router } from "express";
import {
  getBeneficiarios,
  getBeneficiarioById,
  postBeneficiario,
  putBeneficiario,
  deleteBeneficiario,
} from "../controllers/beneficiario.controller.js";

import { verificarToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verificarToken, getBeneficiarios);
router.get("/:id", verificarToken, getBeneficiarioById);
router.post("/", verificarToken, postBeneficiario);
router.put("/:id", verificarToken, putBeneficiario);
router.delete("/:id", verificarToken, deleteBeneficiario);

export default router;
