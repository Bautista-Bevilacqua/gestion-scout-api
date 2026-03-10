import { Request, Response } from "express";
import * as cajaService from "../services/caja.service.js";

export const getMovimientosCaja = async (req: Request, res: Response) => {
  try {
    // Sacamos las fechas de la URL (ej: /api/caja?fechaDesde=2026-03-01)
    const { fechaDesde, fechaHasta } = req.query;

    const movimientos = await cajaService.getMovimientos(
      fechaDesde as string,
      fechaHasta as string,
    );

    res.json(movimientos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const crearMovimientoManual = async (req: Request, res: Response) => {
  try {
    const { tipo, monto, concepto, comprobante, persona_involucrada } =
      req.body;
    const idUsuario = (req as any).usuario?.id;

    if (!idUsuario) {
      return res.status(401).json({ message: "Usuario no autorizado" });
    }

    if (!tipo || !monto || !concepto) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    if (tipo !== "INGRESO" && tipo !== "EGRESO") {
      return res
        .status(400)
        .json({ message: "El tipo debe ser INGRESO o EGRESO" });
    }

    const nuevoMovimiento = await cajaService.crearMovimientoManual(
      tipo,
      Number(monto),
      concepto,
      idUsuario,
      comprobante,
      persona_involucrada,
    );

    res.status(201).json(nuevoMovimiento);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
