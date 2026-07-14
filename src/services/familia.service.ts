import pool from "../config/db.js";
import { Familia } from "../models/familia.model.js";

// GET ALL con Buscador opcional (?q=...)
export const getAll = async (searchQuery?: string): Promise<Familia[]> => {
  let query = "SELECT * FROM familias";
  const params: any[] = [];

  if (searchQuery) {
    query += " WHERE apellido_familia ILIKE $1";
    params.push(`%${searchQuery}%`);
  }

  query += " ORDER BY apellido_familia ASC";
  const { rows } = await pool.query(query, params);
  return rows;
};

export const getById = async (id: number): Promise<Familia | null> => {
  const { rows } = await pool.query(
    "SELECT * FROM familias WHERE id_familia = $1",
    [id],
  );
  return rows.length ? rows[0] : null;
};

// Si un progenitor está desactivado, no confiamos en lo que mande el cliente:
// pisamos sus datos a null para que no quede info vieja/inconsistente en la fila.
const normalizarProgenitores = (data: Familia) => {
  const tienePadre = !!data.tiene_padre;
  const tieneMadre = !!data.tiene_madre;

  if (!tienePadre && !tieneMadre) {
    throw new Error("La familia debe tener al menos un padre o madre cargado");
  }

  const contactoPrincipal: "PADRE" | "MADRE" =
    tienePadre && tieneMadre
      ? data.contacto_principal
      : tienePadre
        ? "PADRE"
        : "MADRE";

  return {
    tienePadre,
    tieneMadre,
    nombre_padre: tienePadre ? data.nombre_padre : null,
    telefono_padre: tienePadre ? data.telefono_padre : null,
    email_padre: tienePadre ? data.email_padre : null,
    nombre_madre: tieneMadre ? data.nombre_madre : null,
    telefono_madre: tieneMadre ? data.telefono_madre : null,
    email_madre: tieneMadre ? data.email_madre : null,
    contactoPrincipal,
  };
};

export const create = async (data: Familia): Promise<Familia> => {
  const { apellido_familia, direccion } = data;
  const n = normalizarProgenitores(data);

  const query = `
    INSERT INTO familias (apellido_familia, tiene_padre, tiene_madre, nombre_padre, nombre_madre, telefono_padre, telefono_madre, email_padre, email_madre, contacto_principal, direccion)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`;
  const { rows } = await pool.query(query, [
    apellido_familia,
    n.tienePadre,
    n.tieneMadre,
    n.nombre_padre,
    n.nombre_madre,
    n.telefono_padre,
    n.telefono_madre,
    n.email_padre,
    n.email_madre,
    n.contactoPrincipal,
    direccion,
  ]);
  return rows[0];
};

export const update = async (
  id: number,
  data: Partial<Familia>,
): Promise<Familia | null> => {
  const { apellido_familia, direccion } = data;
  const n = normalizarProgenitores(data as Familia);

  const query = `
    UPDATE familias
    SET apellido_familia = $1, tiene_padre = $2, tiene_madre = $3, nombre_padre = $4, nombre_madre = $5,
        telefono_padre = $6, telefono_madre = $7, email_padre = $8, email_madre = $9, contacto_principal = $10, direccion = $11
    WHERE id_familia = $12 RETURNING *`;
  const { rows } = await pool.query(query, [
    apellido_familia,
    n.tienePadre,
    n.tieneMadre,
    n.nombre_padre,
    n.nombre_madre,
    n.telefono_padre,
    n.telefono_madre,
    n.email_padre,
    n.email_madre,
    n.contactoPrincipal,
    direccion,
    id,
  ]);
  return rows.length ? rows[0] : null;
};

export const remove = async (id: number): Promise<boolean> => {
  const { rowCount } = await pool.query(
    "DELETE FROM familias WHERE id_familia = $1",
    [id],
  );
  return (rowCount ?? 0) > 0;
};
