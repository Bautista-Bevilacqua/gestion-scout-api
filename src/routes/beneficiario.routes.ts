import { Router } from "express";
import {
  getBeneficiarios,
  postBeneficiario,
  putBeneficiario,
  deleteBeneficiario,
} from "../controllers/beneficiario.controller.js";

const router = Router();

router.get("/", getBeneficiarios);
router.post("/", postBeneficiario);
router.put("/:id", putBeneficiario);
router.delete("/:id", deleteBeneficiario);

export default router;
