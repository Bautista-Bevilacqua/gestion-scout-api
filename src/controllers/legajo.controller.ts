import { Request, Response } from "express";
import * as legajoService from "../services/legajo.service.js";
import { v2 as cloudinary } from "cloudinary";
import pool from "../config/db.js";

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
      file.filename, // <--- Acá le pasás el ID único de Cloudinary
    );

    res.status(201).json(nuevoDoc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const borrarDocumento = async (req: Request, res: Response) => {
  try {
    const { idDocumento } = req.params;

    // 1. Primero buscamos el documento para saber su public_id
    const { rows } = await pool.query(
      "SELECT public_id FROM documentos_legajo WHERE id_documento = $1",
      [idDocumento],
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "Documento no encontrado" });

    const publicId = rows[0].public_id;

    // 2. Le avisamos a Cloudinary que destruya el archivo físico
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }

    // 3. Ahora sí, lo borramos de nuestra base de datos
    await legajoService.eliminarDocumento(Number(idDocumento));

    res.json({
      message: "Documento eliminado correctamente de la BD y de la Nube",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
