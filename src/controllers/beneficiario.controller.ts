import { Request, Response } from "express";
import * as beneficiarioService from "../services/beneficiario.service.js";

export const getBeneficiarios = async (req: Request, res: Response) => {
  try {
    const rolUsuario = (req as any).usuario?.rol;

    if (!rolUsuario) {
      return res
        .status(401)
        .json({ message: "No se pudo identificar el rol del usuario" });
    }

    const data = await beneficiarioService.getAll(rolUsuario);

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getBeneficiarioById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const beneficiario = await beneficiarioService.getById(id);

    if (!beneficiario) {
      return res.status(404).json({ message: "Beneficiario no encontrado" });
    }

    res.json(beneficiario);
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
    console.log("Datos recibidos para actualizar:", req.body);

    const editado = await beneficiarioService.update(
      Number(req.params.id),
      req.body,
    );
    if (!editado) return res.status(404).json({ message: "No encontrado" });
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

export const getByFamilia = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.idFamilia);

    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de familia inválido" });
    }

    const hijos = await beneficiarioService.getPorFamilia(id);
    res.json(hijos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const obtenerHistorial = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const historial = await beneficiarioService.getHistorial(id);
    res.json(historial);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const crearRegistroHistorial = async (req: any, res: Response) => {
  try {
    const idBeneficiario = Number(req.params.id);
    const { descripcion } = req.body;
    const idUsuario = req.usuario.id;

    const nuevoRegistro = await beneficiarioService.agregarRegistroHistorial(
      idBeneficiario,
      descripcion,
      idUsuario,
    );
    res.status(201).json(nuevoRegistro);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
