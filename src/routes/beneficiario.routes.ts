import { Router } from "express";
import {
  getBeneficiarios,
  getBeneficiarioById,
  postBeneficiario,
  putBeneficiario,
  deleteBeneficiario,
} from "../controllers/beneficiario.controller.js";

const router = Router();

router.get("/", getBeneficiarios);
router.get("/:id", getBeneficiarioById);
router.post("/", postBeneficiario);
router.put("/:id", putBeneficiario);
router.delete("/:id", deleteBeneficiario);

export default router;
