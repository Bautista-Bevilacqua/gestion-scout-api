import { Request, Response } from "express";
import * as beneficiarioService from "../services/beneficiario.service.js";

export const getBeneficiarios = async (req: Request, res: Response) => {
  try {
    const data = await beneficiarioService.getAll();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const postBeneficiario = async (req: Request, res: Response) => {
  try {
    const nuevo = await beneficiarioService.create(req.body);
    res.status(201).json(nuevo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const putBeneficiario = async (req: Request, res: Response) => {
  try {
    const editado = await beneficiarioService.update(
      Number(req.params.id),
      req.body,
    );
    res.json(editado);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteBeneficiario = async (req: Request, res: Response) => {
  try {
    await beneficiarioService.remove(Number(req.params.id));
    res.json({ mensaje: "Beneficiario eliminado" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
