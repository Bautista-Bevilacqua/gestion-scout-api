import { Router } from "express";
import {
  getUsuarios,
  createUsuario,
  deleteUsuario,
  getUsuarioById,
  updateUsuario,
} from "../controllers/usuario.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verificarToken, getUsuarios);
router.post("/", verificarToken, createUsuario);
router.get("/:id", verificarToken, getUsuarioById); // <-- TRAER UNO
router.put("/:id", verificarToken, updateUsuario); // <-- ACTUALIZAR
router.delete("/:id", verificarToken, deleteUsuario);

export default router;
