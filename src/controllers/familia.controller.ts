import { Request, Response } from "express";
import * as familiaService from "../services/familia.service.js";

export const getFamilias = async (req: Request, res: Response) => {
  try {
    const { q } = req.query; // Captura ?q=...
    const data = await familiaService.getAll(q as string);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getFamiliaById = async (req: Request, res: Response) => {
  try {
    const familia = await familiaService.getById(Number(req.params.id));
    if (!familia)
      return res.status(404).json({ message: "Familia no encontrada" });
    res.json(familia);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const esErrorDeValidacion = (mensaje: string) =>
  mensaje === "La familia debe tener al menos un padre o madre cargado";

export const postFamilia = async (req: Request, res: Response) => {
  try {
    const nueva = await familiaService.create(req.body);
    res.status(201).json(nueva);
  } catch (error: any) {
    res
      .status(esErrorDeValidacion(error.message) ? 400 : 500)
      .json({ error: error.message });
  }
};

export const putFamilia = async (req: Request, res: Response) => {
  try {
    const editada = await familiaService.update(
      Number(req.params.id),
      req.body,
    );
    if (!editada)
      return res.status(404).json({ message: "Familia no encontrada" });
    res.json(editada);
  } catch (error: any) {
    res
      .status(esErrorDeValidacion(error.message) ? 400 : 500)
      .json({ error: error.message });
  }
};

export const deleteFamilia = async (req: Request, res: Response) => {
  try {
    const eliminada = await familiaService.remove(Number(req.params.id));
    if (!eliminada)
      return res.status(404).json({ message: "Familia no encontrada" });
    res.json({ mensaje: "Familia eliminada" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
