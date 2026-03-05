import { Router } from "express";
import * as familiaController from "../controllers/familia.controller.js";

const router = Router();

import { verificarToken } from "../middlewares/auth.middleware.js";

router.get("/", verificarToken, familiaController.getFamilias);
router.get("/:id", verificarToken, familiaController.getFamiliaById);
router.post("/", verificarToken, familiaController.postFamilia);
router.put("/:id", verificarToken, familiaController.putFamilia);
router.delete("/:id", verificarToken, familiaController.deleteFamilia);

export default router;
