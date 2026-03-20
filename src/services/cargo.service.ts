import pool from "../config/db.js";

export const getCargosPorBeneficiario = async (idBeneficiario: number) => {
  const query = `
    SELECT 
      c.id_cargo, c.monto_final, c.estado, c.fecha_creacion as fecha_cargo,
      con.nombre as concepto_nombre, con.fecha_vencimiento,
      p.fecha_pago, p.metodo_pago,
      u.nombre as cobrador_nombre, u.apellido as cobrador_apellido
    FROM cargos c
    JOIN conceptos_cobro con ON c.id_concepto = con.id_concepto
    LEFT JOIN pagos p ON c.id_cargo = p.id_cargo
    LEFT JOIN usuarios u ON p.id_usuario_cobrador = u.id_usuario
    WHERE c.id_beneficiario = $1
    ORDER BY 
      CASE WHEN c.estado = 'PENDIENTE' THEN 1 ELSE 2 END, -- Los pendientes arriba
      con.fecha_vencimiento ASC;
  `;
  const { rows } = await pool.query(query, [idBeneficiario]);
  return rows;
};

export const registrarPago = async (
  idCargo: number,
  idUsuarioCobrador: number,
  metodoPago: string,
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: cargo } = await client.query(
      `SELECT c.monto_final, c.estado, co.nombre as concepto_nombre, b.nombre, b.apellido
       FROM cargos c
       JOIN conceptos_cobro co ON c.id_concepto = co.id_concepto
       JOIN beneficiarios b ON c.id_beneficiario = b.id_beneficiario
       WHERE c.id_cargo = $1`,
      [idCargo],
    );

    if (cargo.length === 0) throw new Error("Cargo no encontrado");
    if (cargo[0].estado === "PAGADO")
      throw new Error("Este cargo ya se encuentra pagado");

    const monto = cargo[0].monto_final;

    await client.query(
      "UPDATE cargos SET estado = 'PAGADO' WHERE id_cargo = $1",
      [idCargo],
    );

    const { rows: nuevoPago } = await client.query(
      `INSERT INTO pagos (id_cargo, monto_pagado, metodo_pago, id_usuario_cobrador) 
       VALUES ($1, $2, $3, $4) RETURNING id_pago`,
      [idCargo, monto, metodoPago, idUsuarioCobrador],
    );

    const idPago = nuevoPago[0].id_pago;

    const detalleMovimiento = `Cobro: ${cargo[0].concepto_nombre} - ${cargo[0].nombre} ${cargo[0].apellido}`;
    await client.query(
      `INSERT INTO movimientos_caja (tipo, monto, concepto, id_usuario, id_pago)
       VALUES ('INGRESO', $1, $2, $3, $4)`,
      [monto, detalleMovimiento, idUsuarioCobrador, idPago],
    );

    await client.query("COMMIT");
    return { mensaje: "Pago registrado y enviado a caja", id_pago: idPago };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const crearCargoIndividual = async (
  idBeneficiario: number,
  idConcepto: number,
) => {
  const { rows: concepto } = await pool.query(
    "SELECT monto_base FROM conceptos_cobro WHERE id_concepto = $1",
    [idConcepto],
  );

  if (concepto.length === 0) throw new Error("Concepto no encontrado");

  const { rows } = await pool.query(
    `INSERT INTO cargos (id_beneficiario, id_concepto, monto_final, estado) 
     VALUES ($1, $2, $3, 'PENDIENTE') RETURNING *`,
    [idBeneficiario, idConcepto, concepto[0].monto_base],
  );

  return rows[0];
};

export const registrarPagoMultiple = async (
  idsCargos: number[],
  idUsuarioCobrador: number,
  metodoPago: string,
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const id of idsCargos) {
      const { rows: cargo } = await client.query(
        `
        SELECT c.monto_final, c.estado, co.nombre as concepto_nombre, b.nombre, b.apellido
        FROM cargos c
        JOIN conceptos_cobro co ON c.id_concepto = co.id_concepto
        JOIN beneficiarios b ON c.id_beneficiario = b.id_beneficiario
        WHERE c.id_cargo = $1
      `,
        [id],
      );

      if (cargo.length === 0 || cargo[0].estado === "PAGADO") continue;

      const monto = cargo[0].monto_final;

      await client.query(
        "UPDATE cargos SET estado = 'PAGADO' WHERE id_cargo = $1",
        [id],
      );

      const { rows: pagoData } = await client.query(
        `INSERT INTO pagos (id_cargo, monto_pagado, metodo_pago, id_usuario_cobrador) 
         VALUES ($1, $2, $3, $4) RETURNING id_pago`,
        [id, monto, metodoPago, idUsuarioCobrador],
      );

      const idPago = pagoData[0].id_pago;

      const detalleMovimiento = `Cobro: ${cargo[0].concepto_nombre} - ${cargo[0].nombre} ${cargo[0].apellido}`;

      await client.query(
        `INSERT INTO movimientos_caja (tipo, monto, concepto, id_usuario, id_pago)
         VALUES ('INGRESO', $1, $2, $3, $4)`,
        [monto, detalleMovimiento, idUsuarioCobrador, idPago],
      );
    }

    await client.query("COMMIT");
    return { mensaje: "Todos los pagos fueron registrados y pasados a Caja" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
