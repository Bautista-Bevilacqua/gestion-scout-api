import pool from "../config/db.js";

// TRAER TODOS LOS CONCEPTOS
export const getConceptos = async () => {
  const { rows } = await pool.query(
    "SELECT * FROM conceptos_cobro ORDER BY fecha_creacion DESC",
  );
  return rows;
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

    for (const mes of meses) {
      const nombre = `Cuota ${mes} ${anio}`;
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
