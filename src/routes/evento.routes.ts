import { Router } from "express";
import {
  getAll,
  create,
  remove,
  update,
} from "../controllers/evento.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verificarToken, getAll);
router.post("/", verificarToken, create);
router.put("/:id", verificarToken, update);
router.delete("/:id", verificarToken, remove);

export default router;
