import { Request, Response } from "express";
import * as legajoService from "../services/legajo.service.js";
import { v2 as cloudinary } from "cloudinary";

export const getDocumentos = async (req: Request, res: Response) => {
  try {
    const { idBeneficiario } = req.params;
    const documentos = await legajoService.getDocumentosByBeneficiario(
      Number(idBeneficiario),
    );
    res.json(documentos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const subirDocumento = async (req: Request, res: Response) => {
  try {
    const { idBeneficiario } = req.params;
    const file = req.file as any;

    if (!file) {
      return res.status(400).json({ message: "No se envió ningún archivo" });
    }

    const nuevoDoc = await legajoService.guardarDocumento(
      Number(idBeneficiario),
      file.originalname,
      file.path,
      file.mimetype,
    );

    res.status(201).json(nuevoDoc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const borrarDocumento = async (req: Request, res: Response) => {
  try {
    const { idDocumento } = req.params;

    const docEliminado = await legajoService.eliminarDocumento(
      Number(idDocumento),
    );

    if (!docEliminado) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    res.json({ message: "Documento eliminado correctamente" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
