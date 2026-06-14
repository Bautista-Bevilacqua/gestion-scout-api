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
  montoAbonado: number,
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: cargo } = await client.query(
      `SELECT c.id_beneficiario, c.monto_efectivo, c.monto_transferencia, c.estado, co.nombre as concepto_nombre, b.nombre, b.apellido,
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

    // LÓGICA DE BILLETERA VIRTUAL
    if (metodoPago === "SALDO_A_FAVOR") {
      const { rows: ben } = await client.query(
        "SELECT saldo_a_favor FROM beneficiarios WHERE id_beneficiario = $1 FOR UPDATE",
        [cargo[0].id_beneficiario],
      );
      if (Number(ben[0].saldo_a_favor) < montoAbonado) {
        throw new Error(
          "El beneficiario no tiene suficiente saldo a favor en su billetera.",
        );
      }
      // Le restamos la plata de su billetera virtual
      await client.query(
        "UPDATE beneficiarios SET saldo_a_favor = saldo_a_favor - $1 WHERE id_beneficiario = $2",
        [montoAbonado, cargo[0].id_beneficiario],
      );
    }

    const precioObjetivo =
      metodoPago === "EFECTIVO" || metodoPago === "SALDO_A_FAVOR"
        ? cargo[0].monto_efectivo
        : cargo[0].monto_transferencia;
    const nuevoTotalPagado =
      Number(cargo[0].total_pagado) + Number(montoAbonado);
    const nuevoEstado =
      nuevoTotalPagado >= precioObjetivo ? "PAGADO" : "PARCIAL";

    await client.query("UPDATE cargos SET estado = $1 WHERE id_cargo = $2", [
      nuevoEstado,
      idCargo,
    ]);

    const { rows: nuevoPago } = await client.query(
      `INSERT INTO pagos (id_cargo, monto_pagado, metodo_pago, id_usuario_cobrador) VALUES ($1, $2, $3, $4) RETURNING id_pago`,
      [idCargo, montoAbonado, metodoPago, idUsuarioCobrador],
    );

    // 🔴 LA MAGIA CONTABLE: Si pagan con saldo a favor, salteamos el INSERT de la caja
    if (metodoPago !== "SALDO_A_FAVOR") {
      const detalleMovimiento = `Cobro ${nuevoEstado === "PARCIAL" ? "Parcial" : "Total"}: ${cargo[0].concepto_nombre} - ${cargo[0].nombre} ${cargo[0].apellido}`;
      await client.query(
        `INSERT INTO movimientos_caja (tipo, monto, concepto, id_usuario, id_pago) VALUES ('INGRESO', $1, $2, $3, $4)`,
        [
          montoAbonado,
          detalleMovimiento,
          idUsuarioCobrador,
          nuevoPago[0].id_pago,
        ],
      );
    }

    await client.query("COMMIT");
    return {
      mensaje: `Pago ${nuevoEstado} registrado`,
      estado_actual: nuevoEstado,
      id_pago: nuevoPago[0].id_pago,
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

    // Lógica Saldo a Favor Global
    let saldoDisponible = 0;
    let idBeneficiarioCompartido = null;

    if (metodoPago === "SALDO_A_FAVOR") {
      const { rows: testCargo } = await client.query(
        "SELECT id_beneficiario FROM cargos WHERE id_cargo = $1",
        [idsCargos[0]],
      );
      idBeneficiarioCompartido = testCargo[0].id_beneficiario;
      const { rows: ben } = await client.query(
        "SELECT saldo_a_favor FROM beneficiarios WHERE id_beneficiario = $1 FOR UPDATE",
        [idBeneficiarioCompartido],
      );
      saldoDisponible = Number(ben[0].saldo_a_favor);
    }

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
        metodoPago === "EFECTIVO" || metodoPago === "SALDO_A_FAVOR"
          ? cargo[0].monto_efectivo
          : cargo[0].monto_transferencia;
      const montoAFavor =
        Number(precioObjetivo) - Number(cargo[0].total_pagado);

      if (montoAFavor > 0) {
        if (metodoPago === "SALDO_A_FAVOR") {
          if (saldoDisponible < montoAFavor)
            throw new Error(
              "Saldo a favor insuficiente para cubrir todo el carrito.",
            );
          saldoDisponible -= montoAFavor;
          await client.query(
            "UPDATE beneficiarios SET saldo_a_favor = saldo_a_favor - $1 WHERE id_beneficiario = $2",
            [montoAFavor, idBeneficiarioCompartido],
          );
        }

        await client.query(
          "UPDATE cargos SET estado = 'PAGADO' WHERE id_cargo = $1",
          [id],
        );

        const { rows: pagoData } = await client.query(
          `INSERT INTO pagos (id_cargo, monto_pagado, metodo_pago, id_usuario_cobrador) VALUES ($1, $2, $3, $4) RETURNING id_pago`,
          [id, montoAFavor, metodoPago, idUsuarioCobrador],
        );

        if (metodoPago !== "SALDO_A_FAVOR") {
          const detalleMovimiento = `Cobro: ${cargo[0].concepto_nombre} - ${cargo[0].nombre} ${cargo[0].apellido}`;
          await client.query(
            `INSERT INTO movimientos_caja (tipo, monto, concepto, id_usuario, id_pago) VALUES ('INGRESO', $1, $2, $3, $4)`,
            [
              montoAFavor,
              detalleMovimiento,
              idUsuarioCobrador,
              pagoData[0].id_pago,
            ],
          );
        }
      }
    }

    await client.query("COMMIT");
    return { mensaje: "Pagos registrados correctamente" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const cargarSaldoAFavor = async (
  idBeneficiario: number,
  monto: number,
  metodoPago: string,
  idUsuarioCobrador: number,
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Actualizamos la billetera del chico
    const { rows: ben } = await client.query(
      "UPDATE beneficiarios SET saldo_a_favor = saldo_a_favor + $1 WHERE id_beneficiario = $2 RETURNING nombre, apellido",
      [monto, idBeneficiario],
    );

    if (ben.length === 0) throw new Error("Beneficiario no encontrado"); // <-- Agregá este escudo

    // 2. Metemos la plata física en la caja (porque el padre nos dio los billetes HOY)
    // No asociamos id_pago acá porque no es un cargo específico, es plata a favor
    const detalle = `Ingreso de Saldo a Favor - ${ben[0].nombre} ${ben[0].apellido}`;
    await client.query(
      `INSERT INTO movimientos_caja (tipo, monto, concepto, id_usuario) VALUES ('INGRESO', $1, $2, $3)`,
      [monto, detalle, idUsuarioCobrador],
    );

    await client.query("COMMIT");
    return { mensaje: "Saldo cargado exitosamente" };
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
