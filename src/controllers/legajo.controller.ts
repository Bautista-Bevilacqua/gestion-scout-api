import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import * as legajoService from "../services/legajo.service.js";

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
    const file = req.file; // Esto lo genera Multer

    if (!file) {
      return res.status(400).json({ message: "No se envió ningún archivo" });
    }

    const nuevoDoc = await legajoService.guardarDocumento(
      Number(idBeneficiario),
      file.originalname,
      file.filename,
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

    // 1. Lo borramos de la base de datos
    const docEliminado = await legajoService.eliminarDocumento(
      Number(idDocumento),
    );

    if (!docEliminado) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    // 2. Lo borramos físicamente de la carpeta uploads/
    const rutaArchivo = path.resolve("uploads", docEliminado.nombre_archivo);

    // Verificamos si el archivo existe antes de intentar borrarlo
    if (fs.existsSync(rutaArchivo)) {
      fs.unlinkSync(rutaArchivo);
    }

    res.json({ message: "Documento eliminado correctamente" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
