import pool from "../config/db.js";
import { Beneficiario } from "../models/beneficiario.model.js";

export const getAll = async (): Promise<Beneficiario[]> => {
  const { rows } = await pool.query(
    "SELECT * FROM beneficiarios ORDER BY apellido ASC",
  );
  return rows;
};

export const getById = async (id: number): Promise<Beneficiario | null> => {
  const { rows } = await pool.query(
    "SELECT * FROM beneficiarios WHERE id_beneficiario = $1",
    [id],
  );
  return rows.length ? rows[0] : null;
};

export const create = async (data: Beneficiario): Promise<Beneficiario> => {
  const { id_familia, nombre, apellido, dni, fecha_nacimiento, rama_actual } =
    data;

  try {
    const { rows } = await pool.query(
      `INSERT INTO beneficiarios (id_familia, nombre, apellido, dni, fecha_nacimiento, rama_actual) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id_familia, nombre, apellido, dni, fecha_nacimiento, rama_actual],
    );
    return rows[0];
  } catch (error: any) {
    if (error.code === "23503") {
      throw new Error(
        "La familia especificada no existe. Creá la familia primero.",
      );
    }
    throw error;
  }
};

export const update = async (
  id: number,
  data: Partial<Beneficiario>,
): Promise<Beneficiario | null> => {
  const { nombre, apellido, dni, fecha_nacimiento, rama_actual, id_familia } =
    data; // 👈 Asegurate de recibir id_familia

  const query = `
    UPDATE beneficiarios 
    SET 
      nombre = $1, 
      apellido = $2, 
      dni = $3, 
      fecha_nacimiento = $4, 
      rama_actual = $5,
      id_familia = $6 
    WHERE id_beneficiario = $7 
    RETURNING *`;

  const values = [
    nombre,
    apellido,
    dni,
    fecha_nacimiento,
    rama_actual,
    id_familia,
    id,
  ];

  const { rows } = await pool.query(query, values);
  return rows.length ? rows[0] : null;
};

export const remove = async (id: number): Promise<void> => {
  await pool.query("DELETE FROM beneficiarios WHERE id_beneficiario = $1", [
    id,
  ]);
};

export const getPorFamilia = async (idFamilia: number) => {
  const query = `
    SELECT 
      b.id_beneficiario, 
      b.nombre, 
      b.apellido, 
      b.rama_actual,
      b.id_familia,
      -- Cambiamos monto_final por monto_efectivo (o el que uses de base)
      (
        SELECT COALESCE(SUM(c.monto_efectivo), 0) 
        FROM cargos c
        WHERE c.id_beneficiario = b.id_beneficiario 
        AND c.estado = 'PENDIENTE'
      ) as deuda_total
    FROM beneficiarios b
    WHERE b.id_familia = $1
    ORDER BY b.nombre ASC;
  `;
  const { rows } = await pool.query(query, [idFamilia]);
  return rows;
};
export const getHistorial = async (idBeneficiario: number) => {
  const query = `
    SELECT h.*, u.nombre as dirigente_nombre, u.apellido as dirigente_apellido
    FROM historial_beneficiarios h
    LEFT JOIN usuarios u ON h.id_usuario = u.id_usuario
    WHERE h.id_beneficiario = $1
    ORDER BY h.fecha DESC
  `;
  const { rows } = await pool.query(query, [idBeneficiario]);
  return rows;
};

export const agregarRegistroHistorial = async (
  idBeneficiario: number,
  descripcion: string,
  idUsuario: number,
) => {
  const { rows } = await pool.query(
    `INSERT INTO historial_beneficiarios (id_beneficiario, descripcion, id_usuario) 
     VALUES ($1, $2, $3) RETURNING *`,
    [idBeneficiario, descripcion, idUsuario],
  );
  return rows[0];
};
