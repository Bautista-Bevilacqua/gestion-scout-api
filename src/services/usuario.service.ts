import pool from "../config/db.js";
import bcrypt from "bcrypt";
import { enviarMailBienvenida } from "./mailer.service.js";

// Genera una clave aleatoria de 8 caracteres (ej: "a7b9x2pz")
const generarPasswordRandom = () => Math.random().toString(36).slice(-8);

export const crearDirigente = async (data: any) => {
  const { nombre, apellido, dni, email, rol } = data;

  // 1. Generamos la provisoria
  const passwordProvisoria = generarPasswordRandom();

  // 2. La encriptamos para guardarla en la BD
  const passwordEncriptada = await bcrypt.hash(passwordProvisoria, 10);

  try {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, apellido, dni, email, password, rol, debe_cambiar_password) 
       VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id_usuario, nombre, email`,
      [nombre, apellido, dni, email, passwordEncriptada, rol],
    );

    // 3. Si se guardó bien, mandamos el mail CON LA CLAVE SIN ENCRIPTAR para que la lea
    await enviarMailBienvenida(email, nombre, passwordProvisoria);

    return rows[0];
  } catch (error: any) {
    if (error.code === "23505") throw new Error("El DNI o Email ya existen.");
    throw error;
  }
};
