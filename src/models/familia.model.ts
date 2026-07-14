export interface Familia {
  id_familia?: number;
  apellido_familia: string; // El nombre de la familia (ej: "Bevilacqua", "Bevilacqua-Verna")
  tiene_padre: boolean;
  tiene_madre: boolean;
  nombre_padre?: string;
  nombre_madre?: string;
  telefono_padre?: string;
  telefono_madre?: string;
  email_padre?: string;
  email_madre?: string;
  contacto_principal: "PADRE" | "MADRE";
  direccion?: string;
  fecha_creacion?: Date;
}
