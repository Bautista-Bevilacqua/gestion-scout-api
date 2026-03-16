import { Router } from "express";
import {
  getDocumentos,
  subirDocumento,
  borrarDocumento,
} from "../controllers/legajo.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = Router();


router.get("/:idBeneficiario", verificarToken, getDocumentos);

router.post(
  "/:idBeneficiario",
  verificarToken,
  upload.single("archivo"),
  subirDocumento,
);

// Borrar un documento
router.delete("/:idDocumento", verificarToken, borrarDocumento);

export default router;
