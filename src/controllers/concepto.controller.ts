import { Request, Response } from "express";
import * as conceptoService from "../services/concepto.service.js";

export const getAll = async (req: Request, res: Response) => {
  try {
    const conceptos = await conceptoService.getConceptos();
    res.json(conceptos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const nuevoConcepto = await conceptoService.crearConcepto(req.body);
    res.status(201).json(nuevoConcepto);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await conceptoService.eliminarConcepto(id);
    res.json({ mensaje: "Concepto eliminado correctamente" });
  } catch (error: any) {
    // Si da error acá, probablemente sea porque ya hay deudas asignadas a este concepto
    // (Por la restricción ON DELETE RESTRICT que le pusimos en la BD)
    if (error.code === "23503") {
      return res.status(400).json({
        message:
          "No podés borrar este concepto porque ya hay beneficiarios con esta deuda.",
      });
    }
    res.status(500).json({ error: error.message });
  }
};

export const asignar = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const cantidadGenerada =
      await conceptoService.asignarConceptoABeneficiarios(id);

    res.json({
      mensaje: "Cargos generados correctamente",
      cantidad: cantidadGenerada,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDisponibles = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.idBeneficiario);
    const conceptos =
      await conceptoService.getConceptosDisponiblesParaBeneficiario(id);
    res.json(conceptos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createMasivo = async (req: Request, res: Response) => {
  try {
    const conceptos = await conceptoService.crearCuotasMasivas(req.body);
    res.status(201).json(conceptos);
  } catch (error: any) {
    // ---> ATRAPAMOS EL ERROR DE DUPLICADOS (NUEVO) <---
    if (error.message.startsWith("DUPLICADO:")) {
      const mensajeLimpio = error.message.split(": ")[1];
      return res.status(400).json({ message: mensajeLimpio });
    }
    // ----------------------------------------------------
    res.status(500).json({ error: error.message });
  }
};

export const actualizarPrecio = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { monto_efectivo, monto_transferencia, fecha_vencimiento } = req.body;

    if (!monto_efectivo || !monto_transferencia || !fecha_vencimiento) {
      return res
        .status(400)
        .json({ message: "Faltan datos para actualizar el precio" });
    }

    const data = {
      id_concepto: id,
      monto_efectivo,
      monto_transferencia,
      fecha_vencimiento,
    };

    const conceptoActualizado =
      await conceptoService.actualizarPrecioConcepto(data);
    res.json({
      mensaje: "Precio y deudas actualizadas correctamente",
      concepto: conceptoActualizado,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const archivarPagados = async (req: Request, res: Response) => {
  try {
    const cantidad = await conceptoService.archivarConceptosPagados();
    res.json({ mensaje: "Limpieza completada", cantidad });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const archivarIndividual = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await conceptoService.archivarConceptoIndividual(id);
    res.json({ mensaje: "Concepto ocultado correctamente" });
  } catch (error: any) {
    if (error.message === "NO_ARCHIVABLE") {
      return res.status(400).json({
        message:
          "No se puede archivar. Todavía hay beneficiarios que deben este concepto.",
      });
    }
    res.status(500).json({ error: error.message });
  }
};
