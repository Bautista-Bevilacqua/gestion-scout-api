import { Router } from "express";
import {
  createIndividual,
  getByBeneficiario,
  pagar,
  pagarMultiples,
  removeCargo,
} from "../controllers/cargo.controller.js";
import { verificarToken } from "../middlewares/auth.middleware.js";

const router = Router();

// Para ver la cuenta corriente: GET /api/cargos/beneficiario/5
router.get("/beneficiario/:idBeneficiario", verificarToken, getByBeneficiario);

router.post("/individual", verificarToken, createIndividual);
router.post("/pagar-multiples", verificarToken, pagarMultiples);

// Para cobrar una deuda: POST /api/cargos/12/pagar
router.post("/:idCargo/pagar", verificarToken, pagar);
router.delete("/:idCargo", verificarToken, removeCargo);

export default router;
