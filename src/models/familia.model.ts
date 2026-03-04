export interface Familia {
  id_familia?: number;
  apellido_familia: string; // El nombre de la familia (ej: "Bevilacqua-Verna")
  nombre_padre?: string;
  nombre_madre?: string;
  telefono_padre?: string;
  telefono_madre?: string;
  email?: string;
  direccion?: string;
  fecha_creacion?: Date;
}
