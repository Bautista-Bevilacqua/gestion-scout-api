import pool from "../config/db.js";

// 1. TRAER EL LIBRO MAYOR (Con filtros opcionales de fecha)
export const getMovimientos = async (
  fechaDesde?: string,
  fechaHasta?: string,
) => {
  let query = `
    SELECT m.*, u.nombre as usuario_nombre, u.apellido as usuario_apellido
    FROM movimientos_caja m
    LEFT JOIN usuarios u ON m.id_usuario = u.id_usuario
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramCount = 1;

  // Si nos mandan fechas desde Angular, las agregamos al WHERE
  if (fechaDesde) {
    query += ` AND DATE(m.fecha) >= $${paramCount}`;
    params.push(fechaDesde);
    paramCount++;
  }

  if (fechaHasta) {
    query += ` AND DATE(m.fecha) <= $${paramCount}`;
    params.push(fechaHasta);
    paramCount++;
  }

  query += ` ORDER BY m.fecha DESC`; // Los más nuevos primero

  const { rows } = await pool.query(query, params);
  return rows;
};

// 2. CREAR UN MOVIMIENTO MANUAL (Helados, kermesse, compras)
export const crearMovimientoManual = async (
  tipo: "INGRESO" | "EGRESO",
  monto: number,
  concepto: string,
  idUsuario: number,
  comprobante?: string,
  personaInvolucrada?: string, // <-- Nuevo parámetro
) => {
  const { rows } = await pool.query(
    `INSERT INTO movimientos_caja (tipo, monto, concepto, id_usuario, comprobante, persona_involucrada)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      tipo,
      monto,
      concepto,
      idUsuario,
      comprobante || null,
      personaInvolucrada || null,
    ],
  );
  return rows[0];
};
