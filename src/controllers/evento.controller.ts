import { Request, Response } from "express";
import * as eventoService from "../services/evento.service.js";

export const getAll = async (req: Request, res: Response) => {
  try {
    const eventos = await eventoService.getEventos();
    res.json(eventos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const create = async (req: any, res: Response) => {
  try {
    // Sacamos el ID del dirigente que está creando el evento desde el token
    const idUsuario = req.usuario.id;

    const nuevoEvento = await eventoService.crearEvento(req.body, idUsuario);
    res.status(201).json(nuevoEvento);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const eventoActualizado = await eventoService.updateEvento(id, req.body);

    if (!eventoActualizado) {
      return res.status(404).json({ message: "Evento no encontrado" });
    }

    res.json(eventoActualizado);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await eventoService.eliminarEvento(id);
    res.json({ mensaje: "Evento eliminado correctamente" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
