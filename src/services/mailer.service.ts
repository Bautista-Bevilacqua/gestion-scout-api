export const enviarMailBienvenida = async (
  emailDestino: string,
  nombre: string,
  passwordProvisoria: string,
) => {
  console.log("1. Iniciando envío via API directa de Brevo...");

  const url = "https://api.brevo.com/v3/smtp/email";

  const options = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": process.env.BREVO_API_KEY as string,
    },
    body: JSON.stringify({
      sender: {
        name: "Sistema Scout 108",
        email: "bautistabevilacqua@gmail.com", // CAMBIÁ ESTO por el mail que validaste en Brevo
      },
      to: [{ email: emailDestino, name: nombre }],
      subject: "¡Bienvenido al Sistema Scout!",
      htmlContent: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #2e7d32;">¡Siempre Listo, ${nombre}!</h2>
          <p>Tu cuenta ha sido creada con éxito en el Sistema Scout 108.</p>
          <p>Tu contraseña provisoria es: <b style="background: #f4f4f4; padding: 5px;">${passwordProvisoria}</b></p>
          <hr>
          <p style="font-size: 12px; color: #666;">Por favor, cambiá tu clave al ingresar por primera vez.</p>
        </div>`,
    }),
  };

  try {
    const response = await fetch(url, options);
    const result = await response.json();

    if (response.ok) {
      console.log("✅ ¡Éxito! Mail enviado. ID:", result.messageId);
    } else {
      console.error("❌ Brevo rechazó el mail:", result);
    }
  } catch (error) {
    console.error("❌ Error de red al conectar con Brevo:", error);
  }
};
