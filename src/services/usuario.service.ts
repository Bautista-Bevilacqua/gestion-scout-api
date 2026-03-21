import pool from "../config/db.js";
import bcrypt from "bcrypt";
import { enviarMailBienvenida } from "./mailer.service.js";

const generarPasswordRandom = () => Math.random().toString(36).slice(-8);

export const crearDirigente = async (data: any) => {
  const { nombre, apellido, dni, email, rol } = data;

  const passwordProvisoria = generarPasswordRandom();
  const passwordEncriptada = await bcrypt.hash(passwordProvisoria, 10);

  try {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, apellido, dni, email, password, rol, debe_cambiar_password) 
       VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id_usuario, nombre, email`,
      [nombre, apellido, dni, email, passwordEncriptada, rol],
    );

    // 👇 EL SALVAVIDAS: Intentamos mandar el mail, pero si falla, no rompemos todo
    try {
      // VOLVEMOS AL AWAIT: Es preferible que el frontend tarde 1 segundo más
      // a que el mail nunca llegue.
      await enviarMailBienvenida(email, nombre, passwordProvisoria);
      console.log("✅ Proceso de mail completado.");
    } catch (mailError) {
      // Si falla el mail, el usuario ya se creó en la DB, así que solo logueamos
      console.error(
        "⚠️ Usuario creado, pero falló el envío del mail:",
        mailError,
      );
    }

    return rows[0];
  } catch (error: any) {
    if (error.code === "23505") throw new Error("El DNI o Email ya existen.");
    throw error;
  }
};
