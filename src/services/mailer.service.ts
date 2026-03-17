import { Resend } from "resend";

// Poné tu API KEY de Resend en las variables de entorno de Render
const resend = new Resend(process.env.RESEND_API_KEY);

export const enviarMailBienvenida = async (
  emailDestino: string,
  nombre: string,
  passwordProvisoria: string,
) => {
  try {
    await resend.emails.send({
      from: "onboarding@resend.dev", // Resend te da este por defecto para probar sin dominio
      to: emailDestino,
      subject: "¡Bienvenido al Sistema Scout!",
      html: `<p>Hola ${nombre}, tu clave es: <strong>${passwordProvisoria}</strong></p>`,
    });
    console.log("Mail enviado con éxito via Resend");
  } catch (error) {
    console.error("Error en Resend:", error);
  }
};
