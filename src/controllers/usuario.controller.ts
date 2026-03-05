import { Request, Response } from "express";
import pool from "../config/db.js";
import * as usuarioService from "../services/usuario.service.js";

export const getUsuarios = async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      "SELECT id_usuario, nombre, apellido, dni, email, rol, creado_en FROM usuarios ORDER BY apellido ASC",
    );
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createUsuario = async (req: Request, res: Response) => {
  try {
    // Le pasamos la pelota al servicio. Él se encarga de crear, encriptar y mandar el mail.
    const nuevoUsuario = await usuarioService.crearDirigente(req.body);
    res.status(201).json(nuevoUsuario);
  } catch (error: any) {
    // Atajamos el error de DNI o Email duplicado
    if (error.message.includes("ya existen")) {
      return res.status(400).json({ message: error.message });
    }
    // Si falla otra cosa (ej: credenciales de Gmail incorrectas)
    console.error("Error al crear usuario:", error);
    res
      .status(500)
      .json({ error: "Ocurrió un error interno al crear el usuario." });
  }
};

export const deleteUsuario = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const usuarioLogueadoId = (req as any).usuario?.id;
    if (id === usuarioLogueadoId) {
      return res
        .status(400)
        .json({ message: "No podés eliminar tu propio usuario activo." });
    }

    await pool.query("DELETE FROM usuarios WHERE id_usuario = $1", [id]);
    res.json({ mensaje: "Dirigente eliminado correctamente" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getUsuarioById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      "SELECT id_usuario, nombre, apellido, dni, email, rol FROM usuarios WHERE id_usuario = $1",
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ACTUALIZAR LOS DATOS DEL USUARIO
export const updateUsuario = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { nombre, apellido, dni, email, rol } = req.body;

    const { rows } = await pool.query(
      `UPDATE usuarios 
       SET nombre = $1, apellido = $2, dni = $3, email = $4, rol = $5 
       WHERE id_usuario = $6 RETURNING id_usuario, nombre`,
      [nombre, apellido, dni, email, rol, id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json(rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      return res
        .status(400)
        .json({ message: "El DNI o Email ya existen en otro usuario." });
    }
    res.status(500).json({ error: error.message });
  }
};
