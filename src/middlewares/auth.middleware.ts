import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// La misma clave secreta que usaste en auth.service.ts
const SECRET_KEY = process.env.JWT_SECRET;

// Extendemos la Request de Express para que acepte nuestra propiedad "usuario"
export interface AuthRequest extends Request {
  usuario?: any;
}

export const verificarToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  // 1. Buscamos el token en las cabeceras (headers) de la petición
  const authHeader = req.headers.authorization;

  // Si no hay token o no empieza con "Bearer ", lo rebotamos
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Acceso denegado. Token no proporcionado o formato inválido.",
    });
  }

  // 2. Extraemos el token limpio (sacamos la palabra "Bearer ")
  const token = authHeader.split(" ")[1];

  try {
    if (!SECRET_KEY) {
      throw new Error(
        "❌ ERROR CRÍTICO: Falta la variable JWT_SECRET en el archivo .env",
      );
    }
    // 3. Verificamos que el token sea válido y no haya expirado
    const decoded = jwt.verify(token, SECRET_KEY);

    // 4. Si está todo bien, le pegamos los datos del usuario a la petición
    // para que los controladores puedan saber quién está haciendo la acción
    req.usuario = decoded;

    // 5. ¡Le abrimos la puerta! Pasa al controlador
    next();
  } catch (error) {
    return res.status(401).json({
      message:
        "Token inválido o expirado. Por favor, iniciá sesión nuevamente.",
    });
  }
};
