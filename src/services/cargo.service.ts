import pool from "../config/db.js";

export const getCargosPorBeneficiario = async (idBeneficiario: number) => {
  const query = `
    SELECT 
      c.id_cargo, c.monto_efectivo, c.monto_transferencia, c.estado, c.fecha_creacion as fecha_cargo,
      con.nombre as concepto_nombre, con.fecha_vencimiento,
      COALESCE((SELECT SUM(monto_pagado) FROM pagos WHERE id_cargo = c.id_cargo), 0) as total_pagado,
      
      -- MAGIA: Agrupamos todos los pagos de este cargo en un Array de JSON
      (
        SELECT COALESCE(json_agg(
          json_build_object(
            'id_pago', p.id_pago,
            'monto_pagado', p.monto_pagado,
            'metodo_pago', p.metodo_pago,
            'fecha_pago', p.fecha_pago,
            'cobrador_nombre', u.nombre,
            'cobrador_apellido', u.apellido
          ) ORDER BY p.fecha_pago DESC
        ), '[]'::json)
        FROM pagos p
        LEFT JOIN usuarios u ON p.id_usuario_cobrador = u.id_usuario
        WHERE p.id_cargo = c.id_cargo
      ) as historial_pagos
      
    FROM cargos c
    JOIN conceptos_cobro con ON c.id_concepto = con.id_concepto
    WHERE c.id_beneficiario = $1
    ORDER BY 
      CASE WHEN c.estado IN ('PENDIENTE', 'PARCIAL') THEN 1 ELSE 2 END,
      con.fecha_vencimiento ASC;
  `;
  const { rows } = await pool.query(query, [idBeneficiario]);
  return rows;
};

export const registrarPago = async (
  idCargo: number,
  idUsuarioCobrador: number,
  metodoPago: string,
  montoAbonado: number, // <-- AHORA RECIBE CUÁNTA PLATA ENTREGA
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: cargo } = await client.query(
      `SELECT c.monto_efectivo, c.monto_transferencia, c.estado, co.nombre as concepto_nombre, b.nombre, b.apellido,
        COALESCE((SELECT SUM(monto_pagado) FROM pagos WHERE id_cargo = $1), 0) as total_pagado
       FROM cargos c
       JOIN conceptos_cobro co ON c.id_concepto = co.id_concepto
       JOIN beneficiarios b ON c.id_beneficiario = b.id_beneficiario
       WHERE c.id_cargo = $1`,
      [idCargo],
    );

    if (cargo.length === 0) throw new Error("Cargo no encontrado");
    if (cargo[0].estado === "PAGADO")
      throw new Error("Este cargo ya se encuentra pagado");

    // Lógica para saber cuánto debería ser el total según el método elegido
    const precioObjetivo =
      metodoPago === "EFECTIVO"
        ? cargo[0].monto_efectivo
        : cargo[0].monto_transferencia;

    // Sumamos lo que ya tenía pagado + lo que está poniendo ahora
    const nuevoTotalPagado =
      Number(cargo[0].total_pagado) + Number(montoAbonado);

    // ¿Le alcanzó para cancelar la deuda?
    const nuevoEstado =
      nuevoTotalPagado >= precioObjetivo ? "PAGADO" : "PARCIAL";

    // 1. Actualizamos el estado del cargo
    await client.query("UPDATE cargos SET estado = $1 WHERE id_cargo = $2", [
      nuevoEstado,
      idCargo,
    ]);

    // 2. Registramos el recibo/pago en sí
    const { rows: nuevoPago } = await client.query(
      `INSERT INTO pagos (id_cargo, monto_pagado, metodo_pago, id_usuario_cobrador) 
       VALUES ($1, $2, $3, $4) RETURNING id_pago`,
      [idCargo, montoAbonado, metodoPago, idUsuarioCobrador],
    );

    const idPago = nuevoPago[0].id_pago;
    const detalleMovimiento = `Cobro ${nuevoEstado === "PARCIAL" ? "Parcial" : "Total"}: ${cargo[0].concepto_nombre} - ${cargo[0].nombre} ${cargo[0].apellido}`;

    // 3. Mandamos la plata a la caja
    await client.query(
      `INSERT INTO movimientos_caja (tipo, monto, concepto, id_usuario, id_pago)
       VALUES ('INGRESO', $1, $2, $3, $4)`,
      [montoAbonado, detalleMovimiento, idUsuarioCobrador, idPago],
    );

    await client.query("COMMIT");
    return {
      mensaje: `Pago ${nuevoEstado} registrado`,
      estado_actual: nuevoEstado,
      id_pago: idPago,
    };
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
    "SELECT monto_efectivo, monto_transferencia FROM conceptos_cobro WHERE id_concepto = $1",
    [idConcepto],
  );

  if (concepto.length === 0) throw new Error("Concepto no encontrado");

  const { rows } = await pool.query(
    `INSERT INTO cargos (id_beneficiario, id_concepto, monto_efectivo, monto_transferencia, estado) 
     VALUES ($1, $2, $3, $4, 'PENDIENTE') RETURNING *`,
    [
      idBeneficiario,
      idConcepto,
      concepto[0].monto_efectivo,
      concepto[0].monto_transferencia,
    ],
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
        `SELECT c.monto_efectivo, c.monto_transferencia, c.estado, co.nombre as concepto_nombre, b.nombre, b.apellido,
          COALESCE((SELECT SUM(monto_pagado) FROM pagos WHERE id_cargo = $1), 0) as total_pagado
         FROM cargos c
         JOIN conceptos_cobro co ON c.id_concepto = co.id_concepto
         JOIN beneficiarios b ON c.id_beneficiario = b.id_beneficiario
         WHERE c.id_cargo = $1`,
        [id],
      );

      if (cargo.length === 0 || cargo[0].estado === "PAGADO") continue;

      const precioObjetivo =
        metodoPago === "EFECTIVO"
          ? cargo[0].monto_efectivo
          : cargo[0].monto_transferencia;

      // En el pago múltiple, asumimos que paga lo que le falta para cancelar el cargo
      const montoAFavor =
        Number(precioObjetivo) - Number(cargo[0].total_pagado);

      if (montoAFavor > 0) {
        await client.query(
          "UPDATE cargos SET estado = 'PAGADO' WHERE id_cargo = $1",
          [id],
        );

        const { rows: pagoData } = await client.query(
          `INSERT INTO pagos (id_cargo, monto_pagado, metodo_pago, id_usuario_cobrador) 
           VALUES ($1, $2, $3, $4) RETURNING id_pago`,
          [id, montoAFavor, metodoPago, idUsuarioCobrador],
        );

        const detalleMovimiento = `Cobro: ${cargo[0].concepto_nombre} - ${cargo[0].nombre} ${cargo[0].apellido}`;
        await client.query(
          `INSERT INTO movimientos_caja (tipo, monto, concepto, id_usuario, id_pago)
           VALUES ('INGRESO', $1, $2, $3, $4)`,
          [
            montoAFavor,
            detalleMovimiento,
            idUsuarioCobrador,
            pagoData[0].id_pago,
          ],
        );
      }
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

export const eliminarCargo = async (idCargo: number) => {
  const { rowCount } = await pool.query(
    "DELETE FROM cargos WHERE id_cargo = $1 AND estado = 'PENDIENTE'",
    [idCargo],
  );

  if (rowCount === 0) {
    throw new Error(
      "No se puede eliminar una deuda que ya tiene pagos registrados.",
    );
  }
};
