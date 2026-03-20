import { Request, Response } from "express";
import pool from "../config/db.js"; // Importamos pool para buscar los datos del mail
import * as cargoService from "../services/cargo.service.js";
import { enviarMailRecibo } from "../services/mailer.service.js";
import { AuthRequest } from "../middlewares/auth.middleware.js";

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

// ==========================================
// PAGO INDIVIDUAL
// ==========================================
export const pagar = async (req: AuthRequest, res: Response) => {
  try {
    const idCargo = Number(req.params.idCargo);
    const { metodoPago } = req.body;
    const idUsuarioCobrador = req.usuario.id;

    // 1. Buscamos los datos para el mail antes de pagar
    const { rows: datosMail } = await pool.query(
      `SELECT c.monto_final, co.nombre as concepto_nombre, b.nombre as nombre_beneficiario, 
              f.apellido_familia, f.email as email_familia
       FROM cargos c
       JOIN conceptos_cobro co ON c.id_concepto = co.id_concepto
       JOIN beneficiarios b ON c.id_beneficiario = b.id_beneficiario
       JOIN familias f ON b.id_familia = f.id_familia
       WHERE c.id_cargo = $1`,
      [idCargo],
    );

    // 2. Registramos el pago en DB
    const pago = await cargoService.registrarPago(
      idCargo,
      idUsuarioCobrador,
      metodoPago || "EFECTIVO",
    );

    // 3. Disparamos el mail (Silencioso, sin await)
    try {
      if (datosMail.length > 0 && datosMail[0].email_familia) {
        enviarMailRecibo(
          datosMail[0].email_familia,
          datosMail[0].apellido_familia,
          datosMail[0].nombre_beneficiario,
          datosMail[0].monto_final,
          datosMail[0].concepto_nombre,
          metodoPago || "EFECTIVO",
        );
      }
    } catch (mailError) {
      console.error("Error al enviar recibo individual:", mailError);
    }

    res.json({ mensaje: "Pago registrado con éxito", pago });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// ==========================================
// PAGO MÚLTIPLE (CARRITO)
// ==========================================
export const pagarMultiples = async (req: any, res: Response) => {
  try {
    const { ids, metodoPago } = req.body;
    const idUsuarioCobrador = req.usuario.id;

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "Se requiere un array de IDs" });
    }

    // 1. Buscamos los datos de TODOS los cargos a pagar usando ANY($1::int[])
    const { rows: datosMail } = await pool.query(
      `SELECT c.monto_final, co.nombre as concepto_nombre, b.nombre as nombre_beneficiario, 
              f.apellido_familia, f.email as email_familia
       FROM cargos c
       JOIN conceptos_cobro co ON c.id_concepto = co.id_concepto
       JOIN beneficiarios b ON c.id_beneficiario = b.id_beneficiario
       JOIN familias f ON b.id_familia = f.id_familia
       WHERE c.id_cargo = ANY($1::int[])`,
      [ids],
    );

    // 2. Registramos los pagos en DB
    await cargoService.registrarPagoMultiple(
      ids,
      idUsuarioCobrador,
      metodoPago || "EFECTIVO",
    );

    // 3. Disparamos el mail agrupado (Silencioso, sin await)
    try {
      if (datosMail.length > 0 && datosMail[0].email_familia) {
        const montoTotal = datosMail.reduce(
          (acc, curr) => acc + Number(curr.monto_final),
          0,
        );
        const detallePagos = datosMail.map((d) => d.concepto_nombre).join(", ");

        enviarMailRecibo(
          datosMail[0].email_familia,
          datosMail[0].apellido_familia, // Asumimos que todos los cargos son del mismo chico/familia
          datosMail[0].nombre_beneficiario,
          montoTotal,
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
