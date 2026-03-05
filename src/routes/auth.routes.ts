import { Router } from "express";
import {
  cambiarPassword,
  login,
  registrarAdmin,
} from "../controllers/auth.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/login", login);
router.post("/registrar-admin", registrarAdmin);
router.post("/cambiar-password", verificarToken, cambiarPassword);

export default router;
