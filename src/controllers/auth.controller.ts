import { Request, Response } from "express";
import * as authService from "../services/auth.service.js";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email y contraseña son requeridos" });
    }

    const resultado = await authService.loginUsuario(email, password);

    if (!resultado) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    res.json(resultado);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const registrarAdmin = async (req: Request, res: Response) => {
  try {
    const nuevoAdmin = await authService.crearPrimerAdmin(req.body);
    res
      .status(201)
      .json({ mensaje: "Admin creado con éxito", usuario: nuevoAdmin });
  } catch (error: any) {
    // Atajamos el error de DNI/Email duplicado que tira el servicio
    if (error.message.includes("ya están registrados")) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const cambiarPassword = async (req: any, res: Response) => {
  try {
    const { nuevaPassword } = req.body;
    const idUsuario = req.usuario.id;

    if (!nuevaPassword || nuevaPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "La contraseña debe tener al menos 6 caracteres" });
    }

    await authService.cambiarPasswordDefinitiva(idUsuario, nuevaPassword);

    res.json({ mensaje: "Contraseña actualizada correctamente" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
