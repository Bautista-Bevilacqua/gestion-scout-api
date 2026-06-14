import pool from "../config/db.js";

export const getDocumentosByBeneficiario = async (idBeneficiario: number) => {
  const { rows } = await pool.query(
    `SELECT * FROM documentos_legajo WHERE id_beneficiario = $1 ORDER BY fecha_subida DESC`,
    [idBeneficiario],
  );
  return rows;
};

export const guardarDocumento = async (
  idBeneficiario: number,
  nombreOriginal: string,
  nombreArchivo: string, // Acá llega la URL de Cloudinary
  tipoArchivo: string,
  publicId: string, // NUEVO: Acá llega el ID único
) => {
  const { rows } = await pool.query(
    `INSERT INTO documentos_legajo (id_beneficiario, nombre_original, nombre_archivo, tipo_archivo, public_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [idBeneficiario, nombreOriginal, nombreArchivo, tipoArchivo, publicId],
  );
  return rows[0];
};

export const eliminarDocumento = async (idDocumento: number) => {
  const { rows } = await pool.query(
    `DELETE FROM documentos_legajo WHERE id_documento = $1 RETURNING *`,
    [idDocumento],
  );
  return rows[0];
};
