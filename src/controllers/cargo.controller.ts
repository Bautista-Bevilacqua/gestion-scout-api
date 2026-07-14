import { Request, Response } from "express";
import pool from "../config/db.js";
import * as cargoService from "../services/cargo.service.js";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import { enviarMailRecibo } from "../services/mailer.service.js";

export const getByBeneficiario = async (req: Request, res: Response) => {
  try {
    const idBeneficiario = Number(req.params.idBeneficiario);
    const cargos = await cargoService.getCargosPorBeneficiario(idBeneficiario);
    res.json(cargos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createIndividual = async (req: Request, res: Response) => {
  try {
    const { idBeneficiario, idConcepto } = req.body;
    const nuevoCargo = await cargoService.crearCargoIndividual(
      idBeneficiario,
      idConcepto,
    );
    res.status(201).json(nuevoCargo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createPersonalizado = async (req: Request, res: Response) => {
  try {
    const { idBeneficiario, monto, descripcion } = req.body;

    if (!idBeneficiario || !monto || Number(monto) <= 0) {
      return res
        .status(400)
        .json({ message: "Debe indicar beneficiario y un monto válido" });
    }

    const nuevoCargo = await cargoService.crearCargoPersonalizado(
      Number(idBeneficiario),
      Number(monto),
      descripcion,
    );
    res.status(201).json(nuevoCargo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const pagar = async (req: AuthRequest, res: Response) => {
  try {
    const idCargo = Number(req.params.idCargo);
    // AHORA RECIBIMOS montoAbonado
    const { metodoPago, montoAbonado, usarSaldo } = req.body;
    const idUsuarioCobrador = req.usuario.id;

    if (!montoAbonado) {
      return res
        .status(400)
        .json({ message: "Debe ingresar un monto a pagar" });
    }

    const { rows: datosMail } = await pool.query(
      `SELECT COALESCE(co.nombre, c.descripcion, 'Deuda personalizada') as concepto_nombre, b.nombre as nombre_beneficiario,
              f.apellido_familia,
              CASE WHEN f.contacto_principal = 'MADRE' THEN f.email_madre ELSE f.email_padre END as email_familia
       FROM cargos c
       LEFT JOIN conceptos_cobro co ON c.id_concepto = co.id_concepto
       JOIN beneficiarios b ON c.id_beneficiario = b.id_beneficiario
       JOIN familias f ON b.id_familia = f.id_familia
       WHERE c.id_cargo = $1`,
      [idCargo],
    );

    // Le pasamos el montoAbonado al servicio
    const pago = await cargoService.registrarPago(
      idCargo,
      idUsuarioCobrador,
      metodoPago || "EFECTIVO",
      Number(montoAbonado),
      usarSaldo,
    );

    try {
      if (datosMail.length > 0 && datosMail[0].email_familia) {
        // En el mail enviamos lo que ABONÓ realmente, no el costo total
        enviarMailRecibo(
          datosMail[0].email_familia,
          datosMail[0].apellido_familia,
          datosMail[0].nombre_beneficiario,
          Number(montoAbonado),
          datosMail[0].concepto_nombre,
          metodoPago || "EFECTIVO",
        );
      }
    } catch (mailError) {
      console.error("Error al enviar recibo individual:", mailError);
    }

    res.json({ mensaje: pago.mensaje, estado: pago.estado_actual });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const pagarMultiples = async (req: any, res: Response) => {
  try {
    const { ids, metodoPago, usarSaldo } = req.body;
    const idUsuarioCobrador = req.usuario.id;

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "Se requiere un array de IDs" });
    }

    // Para el cobro múltiple (el carrito), traemos los cargos para saber cuánto DEBÍA de cada uno
    const { rows: datosMail } = await pool.query(
      `SELECT c.monto_efectivo, c.monto_transferencia, COALESCE(co.nombre, c.descripcion, 'Deuda personalizada') as concepto_nombre, b.nombre as nombre_beneficiario,
              f.apellido_familia,
              CASE WHEN f.contacto_principal = 'MADRE' THEN f.email_madre ELSE f.email_padre END as email_familia,
              COALESCE((SELECT SUM(monto_pagado) FROM pagos WHERE id_cargo = c.id_cargo), 0) as total_pagado
       FROM cargos c
       LEFT JOIN conceptos_cobro co ON c.id_concepto = co.id_concepto
       JOIN beneficiarios b ON c.id_beneficiario = b.id_beneficiario
       JOIN familias f ON b.id_familia = f.id_familia
       WHERE c.id_cargo = ANY($1::int[])`,
      [ids],
    );

    await cargoService.registrarPagoMultiple(
      ids,
      idUsuarioCobrador,
      metodoPago || "EFECTIVO",
      usarSaldo,
    );

    try {
      if (datosMail.length > 0 && datosMail[0].email_familia) {
        const montoTotalCobrado = datosMail.reduce((acc, curr) => {
          const precioObjetivo =
            metodoPago === "EFECTIVO"
              ? curr.monto_efectivo
              : curr.monto_transferencia;
          const aPagar = Number(precioObjetivo) - Number(curr.total_pagado);
          return acc + (aPagar > 0 ? aPagar : 0);
        }, 0);

        const detallePagos = datosMail.map((d) => d.concepto_nombre).join(", ");

        enviarMailRecibo(
          datosMail[0].email_familia,
          datosMail[0].apellido_familia,
          datosMail[0].nombre_beneficiario,
          montoTotalCobrado,
          detallePagos,
          metodoPago || "EFECTIVO",
        );
      }
    } catch (mailError) {
      console.error("Error al enviar recibo múltiple:", mailError);
    }

    res.json({ mensaje: "Cobro múltiple realizado con éxito" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const removeCargo = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.idCargo);
    await cargoService.eliminarCargo(id);
    res.json({ mensaje: "Deuda desasociada correctamente" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const cargarSaldo = async (req: any, res: Response) => {
  try {
    // EL ARREGLO ESTÁ ACÁ: Sacamos el ID de la URL
    const idBeneficiario = Number(req.params.idBeneficiario);
    const { monto, metodoPago } = req.body;
    const idUsuario = req.usuario.id;

    if (!monto || monto <= 0) {
      return res.status(400).json({ message: "Monto inválido" });
    }

    await cargoService.cargarSaldoAFavor(
      idBeneficiario,
      Number(monto),
      metodoPago || "EFECTIVO",
      idUsuario,
    );
    res.json({ mensaje: "Saldo cargado con éxito" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
