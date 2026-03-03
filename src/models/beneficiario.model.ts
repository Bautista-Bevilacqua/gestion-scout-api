export interface Beneficiario {
  id_beneficiario?: number;
  id_familia: number;
  nombre: string;
  apellido: string;
  dni: string;
  fecha_nacimiento: string | Date;
  rama_actual: "Manada" | "Unidad" | "Caminantes" | "Rovers";
  fecha_ingreso?: Date;
}
