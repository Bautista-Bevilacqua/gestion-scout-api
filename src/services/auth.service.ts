import pool from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// En producción esto tiene que ir en tu archivo .env
const SECRET_KEY = process.env.JWT_SECRET;

export const loginUsuario = async (email: string, passwordPlana: string) => {
  // 1. Buscamos al usuario
  const { rows } = await pool.query("SELECT * FROM usuarios WHERE email = $1", [
    email,
  ]);
  if (rows.length === 0) return null;

  const usuario = rows[0];

  // 2. Comparamos contraseñas
  const passwordValida = await bcrypt.compare(passwordPlana, usuario.password);
  if (!passwordValida) return null;

  if (!SECRET_KEY) {
    throw new Error(
      "❌ ERROR CRÍTICO: Falta la variable JWT_SECRET en el archivo .env",
    );
  }
  // 3. Generamos el token
  const token = jwt.sign(
    { id: usuario.id_usuario, nombre: usuario.nombre, rol: usuario.rol },
    SECRET_KEY,
    { expiresIn: "8h" },
  );

  return {
    token,
    usuario: {
      id: usuario.id_usuario,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      dni: usuario.dni,
      email: usuario.email,
      rol: usuario.rol,
      debe_cambiar_password: usuario.debe_cambiar_password,
    },
  };
};

export const crearPrimerAdmin = async (data: any) => {
  // 1. Agregamos "rol" a lo que extraemos de data
  const { nombre, apellido, dni, email, password, rol } = data;

  const passwordEncriptada = await bcrypt.hash(password, 10);

  try {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, apellido, dni, email, password, rol) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_usuario, nombre, apellido, rol`,
      // 2. Reemplazamos el 'ADMIN' hardcodeado por: rol || 'ADMIN'
      [nombre, apellido, dni, email, passwordEncriptada, rol || "ADMIN"],
    );
    return rows[0];
  } catch (error: any) {
    if (error.code === "23505") {
      throw new Error("El DNI o Email ya están registrados");
    }
    throw error;
  }
};

export const cambiarPasswordDefinitiva = async (
  idUsuario: number,
  nuevaPasswordPlana: string,
) => {
  const passwordEncriptada = await bcrypt.hash(nuevaPasswordPlana, 10);

  await pool.query(
    "UPDATE usuarios SET password = $1, debe_cambiar_password = FALSE WHERE id_usuario = $2",
    [passwordEncriptada, idUsuario],
  );
};
