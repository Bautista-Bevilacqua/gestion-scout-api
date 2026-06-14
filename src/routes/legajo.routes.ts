import { Router } from "express";
import {
  getDocumentos,
  subirDocumento,
  borrarDocumento,
} from "../controllers/legajo.controller.js";
import {
  verificarToken,
  verificarRol,
} from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = Router();
const rolesPermitidos = ["ADMIN", "JEFE_GRUPO", "ADMINISTRACION"];

router.get(
  "/:idBeneficiario",
  verificarToken,
  verificarRol(rolesPermitidos),
  getDocumentos,
);

router.post(
  "/:idBeneficiario",
  verificarToken,
  verificarRol(rolesPermitidos),
  upload.single("archivo"),
  subirDocumento,
);

// Borrar un documento
router.delete(
  "/:idDocumento",
  verificarToken,
  verificarRol(rolesPermitidos),
  borrarDocumento,
);

export default router;
