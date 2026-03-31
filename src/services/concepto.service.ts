import pool from "../config/db.js";

// TRAER TODOS LOS CONCEPTOS
export const getConceptos = async () => {
  const { rows } = await pool.query(
    "SELECT * FROM conceptos_cobro WHERE archivado = FALSE ORDER BY fecha_creacion DESC",
  );
  return rows;
};

export const archivarConceptosPagados = async () => {
  const query = `
    UPDATE conceptos_cobro
    SET archivado = TRUE
    WHERE archivado = FALSE
      AND id_concepto IN (
        SELECT id_concepto 
        FROM cargos 
        GROUP BY id_concepto 
        -- La magia: Tiene que tener al menos 1 cargo generado, 
        -- y la suma de cargos PENDIENTES o PARCIALES tiene que ser exactamente cero.
        HAVING COUNT(*) > 0 
           AND SUM(CASE WHEN estado IN ('PENDIENTE', 'PARCIAL') THEN 1 ELSE 0 END) = 0
      )
    RETURNING id_concepto;
  `;
  const { rows } = await pool.query(query);
  return rows.length; // Devolvemos cuántos conceptos se limpiaron
};

export const archivarConceptoIndividual = async (id: number) => {
  const query = `
    UPDATE conceptos_cobro
    SET archivado = TRUE
    WHERE id_concepto = $1
      AND (
        -- LÓGICA 1: La misma magia del botón masivo (ya todos pagaron)
        id_concepto IN (
          SELECT id_concepto 
          FROM cargos 
          WHERE id_concepto = $1
          GROUP BY id_concepto 
          HAVING COUNT(*) > 0 
             AND SUM(CASE WHEN estado IN ('PENDIENTE', 'PARCIAL') THEN 1 ELSE 0 END) = 0
        )
        -- LÓGICA 2: O nunca se le asignó a nadie (se creó por accidente)
        OR NOT EXISTS (SELECT 1 FROM cargos WHERE id_concepto = $1)
      )
    RETURNING id_concepto;
  `;

  const { rows } = await pool.query(query, [id]);

  // Si no devolvió nada, significa que la consulta falló porque alguien todavía debe plata
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

// ELIMINAR UN CONCEPTO
export const eliminarConcepto = async (id: number) => {
  await pool.query("DELETE FROM conceptos_cobro WHERE id_concepto = $1", [id]);
};

// ASIGNAR CONCEPTO (GENERAR DEUDAS)
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

// TRAER CONCEPTOS DISPONIBLES
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
    ORDER BY nombre ASC;
  `;
  const { rows } = await pool.query(query, [idBeneficiario]);
  return rows;
};

// CREAR CUOTAS MASIVAS
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

    // 1. Creamos las cuotas nuevas del mes
    for (const mes of meses) {
      const nombre = `Cuota ${mes} ${anio}`;

      // ---> MAGIA ANTI-DUPLICADOS (NUEVO) <---
      // Buscamos si ya existe algún concepto con este nombre exacto
      const checkDuplicado = await client.query(
        "SELECT 1 FROM conceptos_cobro WHERE nombre = $1",
        [nombre],
      );

      // Si existe, frenamos la transacción y tiramos un error
      if (checkDuplicado.rowCount && checkDuplicado.rowCount > 0) {
        throw new Error(
          `DUPLICADO: La "${nombre}" ya fue generada anteriormente.`,
        );
      }
      // ----------------------------------------

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

    // --- MAGIA DE ACTUALIZACIÓN AUTOMÁTICA ---

    // 2. Primero actualizamos la deuda de los chicos (los cargos pendientes)
    // que pertenezcan a conceptos vencidos que empiecen con la palabra "Cuota"
    await client.query(
      `UPDATE cargos 
       SET monto_efectivo = $1, monto_transferencia = $2
       WHERE estado != 'PAGADO' 
         AND id_concepto IN (
           SELECT id_concepto FROM conceptos_cobro 
           -- Le damos 1 día de gracia extra antes de aumentarles la deuda
           WHERE fecha_vencimiento < (CURRENT_DATE - INTERVAL '1 day') 
             AND nombre ILIKE 'Cuota%'
         )`,
      [monto_efectivo, monto_transferencia],
    );

    // 3. Actualizamos los conceptos base vencidos (con 1 día de gracia)
    await client.query(
      `UPDATE conceptos_cobro 
       SET monto_efectivo = $1, 
           monto_transferencia = $2, 
           fecha_vencimiento = $3
       WHERE fecha_vencimiento < (CURRENT_DATE - INTERVAL '1 day') 
         AND nombre ILIKE 'Cuota%'`,
      [monto_efectivo, monto_transferencia, fecha_vencimiento || null],
    );

    await client.query("COMMIT");
    return conceptosCreados;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ACTUALIZAR PRECIO DE CONCEPTO VENCIDO (Y SUS CARGOS)
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

    // 1. Actualizamos el concepto base
    const { rows: concepto } = await client.query(
      `UPDATE conceptos_cobro 
       SET monto_efectivo = $1, monto_transferencia = $2, fecha_vencimiento = $3
       WHERE id_concepto = $4 RETURNING *`,
      [monto_efectivo, monto_transferencia, fecha_vencimiento, id_concepto],
    );

    if (concepto.length === 0) throw new Error("Concepto no encontrado");

    // 2. Actualizamos los cargos de los beneficiarios (Ignoramos los PAGADOS)
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
