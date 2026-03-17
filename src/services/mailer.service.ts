import nodemailer from "nodemailer";

// Usamos las variables de entorno que vas a configurar en Render
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const enviarMailBienvenida = async (
  emailDestino: string,
  nombre: string,
  passwordProvisoria: string,
) => {
  const mailOptions = {
    from: '"Sistema Scout 108" <tu_correo_del_grupo@gmail.com>', // Podés poner process.env.EMAIL_USER acá también
    to: emailDestino,
    subject: "¡Bienvenido al Sistema de Gestión Scout!",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #005A9C;">¡Siempre Listo, ${nombre}!</h2>
        <p>Tu cuenta como Dirigente en el sistema del Grupo 108 ha sido creada.</p>
        <p>Tus credenciales de acceso temporal son:</p>
        <ul>
          <li><strong>Email:</strong> ${emailDestino}</li>
          <li><strong>Contraseña provisoria:</strong> <span style="background: #eee; padding: 4px 8px; font-family: monospace;">${passwordProvisoria}</span></li>
        </ul>
        <p>Por seguridad, el sistema te pedirá que cambies esta contraseña la primera vez que ingreses.</p>
        <br>
        <p>Un abrazo scout,</p>
        <p><strong>El Equipo de Administración</strong></p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};
