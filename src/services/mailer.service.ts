import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.EMAIL_USER,
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    refreshToken: process.env.OAUTH_REFRESH_TOKEN,
  },
});

export const enviarMailBienvenida = async (
  emailDestino: string,
  nombre: string,
  passwordProvisoria: string,
) => {
  const mailOptions = {
    from: `"Sistema Scout 108" <${process.env.EMAIL_USER}>`,
    to: emailDestino,
    subject: "¡Bienvenido al Sistema de Gestión Scout!",
    html: `
      <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
        <h2 style="color: #2c3e50;">¡Siempre Listo, ${nombre}!</h2>
        <p>Se ha creado tu cuenta como dirigente para el <b>Grupo Scout 108</b>.</p>
        <p>Tus credenciales de acceso son:</p>
        <p><b>Usuario:</b> ${emailDestino}</p>
        <p><b>Contraseña temporal:</b> <span style="background-color: #f1f1f1; padding: 5px; font-family: monospace;">${passwordProvisoria}</span></p>
        <hr>
        <p style="font-size: 12px; color: #7f8c8d;">Por favor, cambia tu contraseña al ingresar por primera vez.</p>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
};
