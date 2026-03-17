import { Resend } from "resend";

// Opción recomendada: inicializarlo así para evitar el error de "Missing API key" en el arranque
export const enviarMailBienvenida = async (
  emailDestino: string,
  nombre: string,
  passwordProvisoria: string,
) => {
  console.log("1. Intentando iniciar envío a:", emailDestino);

  if (!process.env.RESEND_API_KEY) {
    console.error(
      "ERROR: La API Key de Resend no está cargada en las variables de entorno.",
    );
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    console.log("2. Llamando a Resend API...");
    const response = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: emailDestino,
      subject: "¡Bienvenido al Sistema Scout!",
      html: `<strong>Hola ${nombre}</strong>, tu contraseña es: ${passwordProvisoria}`,
    });

    if (response.error) {
      console.error("3. Resend devolvió un error:", response.error);
    } else {
      console.log("3. ¡Éxito! ID del mail:", response.data?.id);
    }
  } catch (err) {
    console.error("4. Error crítico atrapado en el catch:", err);
  }
};
