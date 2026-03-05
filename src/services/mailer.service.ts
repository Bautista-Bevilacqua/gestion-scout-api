import nodemailer from "nodemailer";

// Configuramos el "cartero" usando Gmail.
// OJO: Vas a necesitar crear una "Contraseña de Aplicación" en tu cuenta de Google para que esto funcione.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "bautistabevilacqua@gmail.com", // Cambiá esto
    pass: "psrp izrb hgys bich", // No es tu clave normal, es una generada por Google
  },
});

export const enviarMailBienvenida = async (
  emailDestino: string,
  nombre: string,
  passwordProvisoria: string,
) => {
  const mailOptions = {
    from: '"Sistema Scout 108" <tu_correo_del_grupo@gmail.com>',
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
