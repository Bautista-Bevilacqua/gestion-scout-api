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
        email: "bautistabevilacqua@gmail.com",
      },
      to: [{ email: emailDestino, name: nombre }],
      subject: "¡Bienvenido al Sistema Scout!",
      htmlContent: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #2e7d32;">¡Siempre Listo, ${nombre}!</h2>
          <p>Tu cuenta ha sido creada con éxito en el Sistema Scout 108.</p>
          <p>Ingresa a <a href="https://grupo108.vercel.app/" target="_blank">https://grupo108.vercel.app/</a> utilizando tu correo electrónico y la contraseña provisoria.</p>
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

export const enviarMailRecibo = async (
  emailDestino: string,
  nombreFamilia: string,
  nombreBeneficiario: string,
  montoTotal: number,
  detallePagos: string,
  metodoPago: string,
) => {
  console.log("1. Iniciando envío de recibo via Brevo...");

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
        name: "Tesorería - Grupo Scout 108",
        email: "bautistabevilacqua@gmail.com",
      },
      to: [{ email: emailDestino, name: nombreFamilia }],
      subject: "🧾 Recibo de Pago - Grupo Scout 108",
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #2563eb; text-align: center;">¡Pago Recibido!</h2>
          <p>Hola, Familia <strong>${nombreFamilia}</strong>:</p>
          <p>Hemos registrado correctamente un pago en la cuenta de <strong>${nombreBeneficiario}</strong>. ¡Muchas gracias por mantener la cuota al día!</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Detalle del comprobante:</h3>
            <ul style="color: #4b5563;">
              <li><strong>Conceptos abonados:</strong> ${detallePagos}</li>
              <li><strong>Medio de pago:</strong> ${metodoPago}</li>
              <li><strong>Fecha:</strong> ${new Date().toLocaleDateString("es-AR")}</li>
            </ul>
            <h2 style="margin-bottom: 0; color: #111827; text-align: right;">Total pagado: $${montoTotal}</h2>
          </div>
          
          <p style="font-size: 13px; color: #6b7280; text-align: center;">
            Este es un comprobante automático generado por el Sistema de Gestión del Grupo 108.<br>
            ¡Siempre Listos! ⚜️
          </p>
        </div>`,
    }),
  };

  try {
    const response = await fetch(url, options);
    const result = await response.json();
    if (response.ok) {
      console.log("✅ Recibo enviado. ID:", result.messageId);
    } else {
      console.error("❌ Error en Brevo (Recibo):", result);
    }
  } catch (error) {
    console.error("❌ Error de red con Brevo:", error);
  }
};
