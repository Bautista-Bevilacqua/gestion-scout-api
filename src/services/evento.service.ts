import pool from "../config/db.js";

// TRAER TODOS LOS EVENTOS
export const getEventos = async () => {
  const { rows } = await pool.query(
    "SELECT * FROM eventos ORDER BY fecha_inicio ASC",
  );
  return rows;
};

// CREAR UN EVENTO
export const crearEvento = async (data: any, idUsuario: number) => {
  const { titulo, descripcion, fecha_inicio, fecha_fin, alcance, color } = data;

  const { rows } = await pool.query(
    `INSERT INTO eventos (titulo, descripcion, fecha_inicio, fecha_fin, alcance, color, id_usuario) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      titulo,
      descripcion || null,
      fecha_inicio,
      fecha_fin || null,
      alcance || "GRUPO",
      color || "#3788d8",
      idUsuario,
    ],
  );

  return rows[0];
};

export const updateEvento = async (id: number, data: any) => {
  const { titulo, descripcion, fecha_inicio, fecha_fin, alcance, color } = data;

  const { rows } = await pool.query(
    `UPDATE eventos 
     SET titulo = $1, descripcion = $2, fecha_inicio = $3, fecha_fin = $4, alcance = $5, color = $6
     WHERE id_evento = $7 RETURNING *`,
    [
      titulo,
      descripcion || null,
      fecha_inicio,
      fecha_fin || null,
      alcance,
      color,
      id,
    ],
  );

  return rows[0];
};

// ELIMINAR UN EVENTO
export const eliminarEvento = async (id: number) => {
  await pool.query("DELETE FROM eventos WHERE id_evento = $1", [id]);
};
