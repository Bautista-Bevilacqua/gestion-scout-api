import pool from "../config/db.js";

// TRAER TODOS LOS CONCEPTOS
export const getConceptos = async () => {
  const { rows } = await pool.query(
    "SELECT * FROM conceptos_cobro WHERE archivado = FALSE ORDER BY fecha_creacion DESC",
  );
  return rows;
};

// ARCHIVAR TODOS LOS CONCEPTOS QUE YA ESTÁN PAGADOS POR TODOS
export const archivarConceptosPagados = async () => {
  const query = `
    UPDATE conceptos_cobro
    SET archivado = TRUE
    WHERE archivado = FALSE
      AND id_concepto IN (
        SELECT id_concepto 
        FROM cargos 
        GROUP BY id_concepto 
        HAVING COUNT(*) > 0 
           AND SUM(CASE WHEN estado IN ('PENDIENTE', 'PARCIAL') THEN 1 ELSE 0 END) = 0
      )
    RETURNING id_concepto;
  `;
  const { rows } = await pool.query(query);
  return rows.length;
};

// ARCHIVAR UN CONCEPTO INDIVIDUAL (SOLO SI NO TIENE DEUDAS PENDIENTES)
export const archivarConceptoIndividual = async (id: number) => {
  const query = `
    UPDATE conceptos_cobro
    SET archivado = TRUE
    WHERE id_concepto = $1
      AND (
        id_concepto IN (
          SELECT id_concepto 
          FROM cargos 
          WHERE id_concepto = $1
          GROUP BY id_concepto 
          HAVING COUNT(*) > 0 
             AND SUM(CASE WHEN estado IN ('PENDIENTE', 'PARCIAL') THEN 1 ELSE 0 END) = 0
        )
        OR NOT EXISTS (SELECT 1 FROM cargos WHERE id_concepto = $1)
      )
    RETURNING id_concepto;
  `;

  const { rows } = await pool.query(query, [id]);

  if (rows.length === 0) {
    throw new Error("NO_ARCHIVABLE");
  }
};

// CREAR UN NUEVO CONCEPTO
export const crearConcepto = async (data: any) => {
  const {
    nombre,
    monto_efectivo,
    monto_transferencia,
    alcance,
    fecha_vencimiento,
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO conceptos_cobro (nombre, monto_efectivo, monto_transferencia, alcance, fecha_vencimiento) 
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      nombre,
      monto_efectivo,
      monto_transferencia,
      alcance,
      fecha_vencimiento || null,
    ],
  );

  return rows[0];
};

// ELIMINAR UN CONCEPTO (SOLO SI NO TIENE HIJOS)
export const eliminarConcepto = async (id: number) => {
  await pool.query("DELETE FROM conceptos_cobro WHERE id_concepto = $1", [id]);
};

// ASIGNAR CONCEPTO A BENEFICIARIOS (GENERAR DEUDAS)
export const asignarConceptoABeneficiarios = async (idConcepto: number) => {
  const { rows: conceptos } = await pool.query(
    "SELECT monto_efectivo, monto_transferencia, alcance FROM conceptos_cobro WHERE id_concepto = $1",
    [idConcepto],
  );

  if (conceptos.length === 0) throw new Error("Concepto no encontrado");

  const { monto_efectivo, monto_transferencia, alcance } = conceptos[0];

  const query = `
    INSERT INTO cargos (id_beneficiario, id_concepto, monto_efectivo, monto_transferencia, estado)
    SELECT id_beneficiario, $1, $2, $3, 'PENDIENTE'
    FROM beneficiarios
    WHERE ($4 = 'GRUPO' OR UPPER(rama_actual) = UPPER($4))
      AND NOT EXISTS (
        SELECT 1 FROM cargos 
        WHERE cargos.id_beneficiario = beneficiarios.id_beneficiario 
          AND cargos.id_concepto = $1
      )
    RETURNING id_cargo;
  `;

  const { rows: cargosGenerados } = await pool.query(query, [
    idConcepto,
    monto_efectivo,
    monto_transferencia,
    alcance,
  ]);

  return cargosGenerados.length;
};

// TRAER CONCEPTOS DISPONIBLES PARA UN BENEFICIARIO ESPECÍFICO
export const getConceptosDisponiblesParaBeneficiario = async (
  idBeneficiario: number,
) => {
  const query = `
    SELECT * FROM conceptos_cobro 
    WHERE (alcance = 'GRUPO' OR UPPER(alcance) = (
      SELECT UPPER(rama_actual) FROM beneficiarios WHERE id_beneficiario = $1
    ))
    AND id_concepto NOT IN (
      SELECT id_concepto FROM cargos WHERE id_beneficiario = $1
    )
    AND archivado = FALSE
    ORDER BY nombre ASC;
  `;
  const { rows } = await pool.query(query, [idBeneficiario]);
  return rows;
};

// --- CREAR CUOTAS MASIVAS CON ACTUALIZACIÓN INTELIGENTE ---
export const crearCuotasMasivas = async (data: any) => {
  const {
    meses,
    anio,
    monto_efectivo,
    monto_transferencia,
    alcance,
    fecha_vencimiento,
  } = data;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const conceptosCreados = [];

    // 1. Crear las cuotas nuevas solicitadas
    for (const mes of meses) {
      const nombre = `Cuota ${mes} ${anio}`;

      const checkDuplicado = await client.query(
        "SELECT 1 FROM conceptos_cobro WHERE nombre = $1",
        [nombre],
      );

      if (checkDuplicado.rowCount && checkDuplicado.rowCount > 0) {
        throw new Error(
          `DUPLICADO: La "${nombre}" ya fue generada anteriormente.`,
        );
      }

      const { rows } = await client.query(
        `INSERT INTO conceptos_cobro (nombre, monto_efectivo, monto_transferencia, alcance, fecha_vencimiento) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          nombre,
          monto_efectivo,
          monto_transferencia,
          alcance,
          fecha_vencimiento || null,
        ],
      );
      conceptosCreados.push(rows[0]);
    }

    await client.query("COMMIT");
    return conceptosCreados;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ACTUALIZAR PRECIO MANUAL DE UN CONCEPTO
export const actualizarPrecioConcepto = async (data: any) => {
  const {
    id_concepto,
    monto_efectivo,
    monto_transferencia,
    fecha_vencimiento,
  } = data;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: concepto } = await client.query(
      `UPDATE conceptos_cobro 
       SET monto_efectivo = $1, monto_transferencia = $2, fecha_vencimiento = $3
       WHERE id_concepto = $4 RETURNING *`,
      [monto_efectivo, monto_transferencia, fecha_vencimiento, id_concepto],
    );

    if (concepto.length === 0) throw new Error("Concepto no encontrado");

    await client.query(
      `UPDATE cargos 
       SET monto_efectivo = $1, monto_transferencia = $2
       WHERE id_concepto = $3 AND estado != 'PAGADO'`,
      [monto_efectivo, monto_transferencia, id_concepto],
    );

    await client.query("COMMIT");
    return concepto[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const sincronizarPreciosAutomaticamente = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Buscamos cuál es el precio de HOY
    const { rows: cuotaVigente } = await client.query(
      `SELECT monto_efectivo, monto_transferencia 
       FROM conceptos_cobro 
       WHERE nombre ILIKE 'Cuota%' 
         AND fecha_vencimiento >= CURRENT_DATE 
       ORDER BY fecha_vencimiento ASC 
       LIMIT 1`,
    );

    if (cuotaVigente.length > 0) {
      const {
        monto_efectivo: precioHoy,
        monto_transferencia: precioTransfHoy,
      } = cuotaVigente[0];

      // 2. Actualizamos deudas vencidas
      await client.query(
        `UPDATE cargos 
         SET monto_efectivo = $1, monto_transferencia = $2
         WHERE estado != 'PAGADO' 
           AND id_concepto IN (
             SELECT id_concepto FROM conceptos_cobro 
             WHERE fecha_vencimiento < CURRENT_DATE 
               AND nombre ILIKE 'Cuota%'
           )`,
        [precioHoy, precioTransfHoy],
      );

      // 3. Actualizamos conceptos vencidos
      await client.query(
        `UPDATE conceptos_cobro 
         SET monto_efectivo = $1, monto_transferencia = $2
         WHERE fecha_vencimiento < CURRENT_DATE 
           AND nombre ILIKE 'Cuota%'`,
        [precioHoy, precioTransfHoy],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error en el Cron Job de precios:", error);
  } finally {
    client.release();
  }
};
