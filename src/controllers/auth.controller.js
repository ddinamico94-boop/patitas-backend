const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { z } = require('zod');
const { OAuth2Client } = require('google-auth-library');
const { Resend } = require('resend');

const prisma = require('../lib/prisma');
const { signToken } = require('../utils/jwt');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const resend = new Resend(process.env.RESEND_API_KEY);

// ======================================================
// VALIDACIONES
// ======================================================

const registerSchema = z.object({
  name: z.string().min(2, 'El nombre es muy corto'),
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

const googleLoginSchema = z.object({
  credential: z.string().min(1, 'Falta el token de Google'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

const verifyResetCodeSchema = z.object({
  email: z.string().email('Email inválido'),
  code: z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
});

const resetPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
  code: z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}

function hashResetCode(code) {
  return crypto
    .createHash('sha256')
    .update(code)
    .digest('hex');
}

function resetCodeMatches(storedCodeHash, code) {
  const receivedCodeHash = hashResetCode(code);

  const storedHash = Buffer.from(storedCodeHash, 'hex');
  const receivedHash = Buffer.from(receivedCodeHash, 'hex');

  if (storedHash.length !== receivedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedHash, receivedHash);
}

// ======================================================
// REGISTRO
// ======================================================

async function register(req, res) {
  const data = registerSchema.parse(req.body);

  const normalizedEmail = data.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (existing) {
    return res.status(409).json({
      error: 'Ya existe una cuenta con ese email.',
    });
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: normalizedEmail,
      phone: data.phone,
      passwordHash,
    },
  });

  const token = signToken({
    sub: user.id,
    role: 'authenticated',
  });

  return res.status(201).json({
    user: toPublicUser(user),
    token,
  });
}

// ======================================================
// LOGIN
// ======================================================

async function login(req, res) {
  const data = loginSchema.parse(req.body);

  const normalizedEmail = data.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (!user || !user.passwordHash) {
    return res.status(401).json({
      error: 'Email o contraseña incorrectos.',
    });
  }

  const valid = await bcrypt.compare(
    data.password,
    user.passwordHash
  );

  if (!valid) {
    return res.status(401).json({
      error: 'Email o contraseña incorrectos.',
    });
  }

  const token = signToken({
    sub: user.id,
    role: 'authenticated',
  });

  return res.json({
    user: toPublicUser(user),
    token,
  });
}

// ======================================================
// GOOGLE LOGIN
// ======================================================

async function googleLogin(req, res) {
  const { credential } = googleLoginSchema.parse(req.body);

  let payload;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    payload = ticket.getPayload();
  } catch (error) {
    return res.status(401).json({
      error: 'Token de Google inválido.',
    });
  }

  const {
    sub: googleId,
    email,
    name,
    picture,
  } = payload;

  if (!email) {
    return res.status(400).json({
      error:
        'No se pudo obtener el email de la cuenta de Google.',
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  let user = await prisma.user.findUnique({
    where: {
      googleId,
    },
  });

  if (!user) {
    user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (user) {
      user = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          googleId,
          avatarUrl: user.avatarUrl || picture,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name:
            name ||
            normalizedEmail.split('@')[0],
          email: normalizedEmail,
          googleId,
          avatarUrl: picture,
        },
      });
    }
  }

  const token = signToken({
    sub: user.id,
    role: 'authenticated',
  });

  return res.json({
    user: toPublicUser(user),
    token,
  });
}

// ======================================================
// USUARIO ACTUAL
// ======================================================

async function me(req, res) {
  const user = await prisma.user.findUnique({
    where: {
      id: req.user.id,
    },
  });

  if (!user) {
    return res.status(404).json({
      error: 'Usuario no encontrado.',
    });
  }

  return res.json({
    user: toPublicUser(user),
  });
}

// ======================================================
// OLVIDÉ MI CONTRASEÑA
// ======================================================

async function forgotPassword(req, res) {
  const { email } = forgotPasswordSchema.parse(req.body);

  const normalizedEmail = email.trim().toLowerCase();

  const genericMessage =
    'Si existe una cuenta con ese email, recibirás un código de recuperación.';

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  // No revelamos si existe una cuenta.
  if (!user) {
    return res.json({
      message: genericMessage,
    });
  }

  // Si la cuenta solamente utiliza Google,
  // no tiene contraseña local para recuperar.
  if (!user.passwordHash && user.googleId) {
    return res.json({
      message: genericMessage,
    });
  }

  // Código de 6 dígitos.
  const code = crypto
    .randomInt(100000, 1000000)
    .toString();

  const codeHash = hashResetCode(code);

  // El código dura 10 minutos.
  const expiresAt = new Date(
    Date.now() + 10 * 60 * 1000
  );

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      resetPasswordCodeHash: codeHash,
      resetPasswordExpiresAt: expiresAt,
    },
  });

  try {
    const { error } = await resend.emails.send({
      from:
        process.env.EMAIL_FROM ||
        'no-reply@patitastucuman.com',

      to: user.email,

      subject:
        'Código para recuperar tu cuenta | Patitas Tucumán',

      html: `
<!DOCTYPE html>
<html lang="es">

<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>Recuperar contraseña</title>
</head>

<body
  style="
    margin: 0;
    padding: 0;
    background-color: #FAF8F4;
    font-family: Arial, Helvetica, sans-serif;
    color: #1C1917;
  "
>

  <div
    style="
      max-width: 560px;
      margin: 0 auto;
      padding: 40px 20px;
    "
  >

    <div
      style="
        background-color: #ffffff;
        border-radius: 18px;
        padding: 36px;
        border: 1px solid #E0D6CC;
      "
    >

      <!-- ============================================ -->
      <!-- LOGO -->
      <!-- ============================================ -->

      <table
        role="presentation"
        cellpadding="0"
        cellspacing="0"
        border="0"
        style="
          margin: 0 0 28px 0;
          border-collapse: collapse;
        "
      >
        <tr>

          <!-- Huellita -->
          <td
            style="
              vertical-align: middle;
              padding: 0 10px 0 0;
            "
          >
            <img
              src="https://www.patitastucuman.com/favicon.svg"
              width="36"
              height="36"
              alt=""
              style="
                display: block;
                width: 36px;
                height: 36px;
                border: 0;
                outline: none;
              "
            />
          </td>

          <!-- Patitas Tucumán -->
          <td
            style="
              vertical-align: middle;
              padding: 0;
            "
          >
            <img
              src="https://www.patitastucuman.com/logo-texto.png"
              width="205"
              alt="Patitas Tucumán"
              style="
                display: block;
                width: 205px;
                max-width: 100%;
                height: auto;
                border: 0;
                outline: none;
                text-decoration: none;
              "
            />
          </td>

        </tr>
      </table>

      <!-- ============================================ -->
      <!-- CONTENIDO -->
      <!-- ============================================ -->

      <h1
        style="
          font-family: Georgia, serif;
          font-size: 24px;
          font-weight: 600;
          line-height: 1.3;
          margin: 0 0 16px;
          color: #1C1917;
        "
      >
        Recuperá tu contraseña
      </h1>

      <p
        style="
          margin: 0 0 14px;
          font-size: 15px;
          line-height: 1.6;
          color: #6d625c;
        "
      >
        Hola ${user.name},
      </p>

      <p
        style="
          margin: 0 0 14px;
          font-size: 15px;
          line-height: 1.6;
          color: #6d625c;
        "
      >
        Recibimos una solicitud para cambiar la contraseña
        de tu cuenta de Patitas Tucumán.
      </p>

      <p
        style="
          margin: 0;
          font-size: 15px;
          line-height: 1.6;
          color: #6d625c;
        "
      >
        Ingresá el siguiente código en la página:
      </p>

      <!-- ============================================ -->
      <!-- CÓDIGO -->
      <!-- ============================================ -->

      <div
        style="
          margin: 28px 0;
          padding: 22px 15px;
          background-color: #FAF8F4;
          border: 1px solid #E0D6CC;
          border-radius: 12px;
          text-align: center;
        "
      >
        <span
          style="
            font-family: Arial, Helvetica, sans-serif;
            font-size: 34px;
            line-height: 42px;
            font-weight: 700;
            letter-spacing: 8px;
            color: #1C1917;
          "
        >
          ${code}
        </span>
      </div>

      <p
        style="
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: #6d625c;
        "
      >
        Este código vence en
        <strong>10 minutos</strong>.
      </p>

      <p
        style="
          margin: 28px 0 0;
          font-size: 13px;
          line-height: 1.6;
          color: #968a83;
        "
      >
        Si no solicitaste cambiar tu contraseña,
        podés ignorar este correo.
      </p>

    </div>

    <!-- ============================================ -->
    <!-- FOOTER -->
    <!-- ============================================ -->

    <p
      style="
        text-align: center;
        font-size: 12px;
        line-height: 1.5;
        color: #9C8A82;
        margin: 20px 0 0;
      "
    >
      Patitas Tucumán · Tucumán, Argentina
    </p>

  </div>

</body>

</html>
      `,
    });

    if (error) {
      console.error(
        'Error de Resend:',
        error
      );

      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          resetPasswordCodeHash: null,
          resetPasswordExpiresAt: null,
        },
      });

      return res.status(500).json({
        error:
          'No pudimos enviar el código. Intentá nuevamente.',
      });
    }
  } catch (error) {
    console.error(
      'Error al enviar email de recuperación:',
      error
    );

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        resetPasswordCodeHash: null,
        resetPasswordExpiresAt: null,
      },
    });

    return res.status(500).json({
      error:
        'No pudimos enviar el código. Intentá nuevamente.',
    });
  }

  return res.json({
    message: genericMessage,
  });
}

// ======================================================
// VERIFICAR CÓDIGO
// ======================================================

async function verifyResetCode(req, res) {
  const {
    email,
    code,
  } = verifyResetCodeSchema.parse(req.body);

  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (
    !user ||
    !user.resetPasswordCodeHash ||
    !user.resetPasswordExpiresAt
  ) {
    return res.status(400).json({
      error: 'El código es inválido o expiró.',
    });
  }

  if (new Date() > user.resetPasswordExpiresAt) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        resetPasswordCodeHash: null,
        resetPasswordExpiresAt: null,
      },
    });

    return res.status(400).json({
      error: 'El código es inválido o expiró.',
    });
  }

  const valid = resetCodeMatches(
    user.resetPasswordCodeHash,
    code
  );

  if (!valid) {
    return res.status(400).json({
      error: 'El código es inválido o expiró.',
    });
  }

  return res.json({
    message: 'Código verificado correctamente.',
  });
}

// ======================================================
// CAMBIAR CONTRASEÑA
// ======================================================

async function resetPassword(req, res) {
  const {
    email,
    code,
    password,
  } = resetPasswordSchema.parse(req.body);

  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (
    !user ||
    !user.resetPasswordCodeHash ||
    !user.resetPasswordExpiresAt
  ) {
    return res.status(400).json({
      error: 'El código es inválido o expiró.',
    });
  }

  if (new Date() > user.resetPasswordExpiresAt) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        resetPasswordCodeHash: null,
        resetPasswordExpiresAt: null,
      },
    });

    return res.status(400).json({
      error: 'El código es inválido o expiró.',
    });
  }

  const valid = resetCodeMatches(
    user.resetPasswordCodeHash,
    code
  );

  if (!valid) {
    return res.status(400).json({
      error: 'El código es inválido o expiró.',
    });
  }

  const newPasswordHash = await bcrypt.hash(
    password,
    10
  );

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      passwordHash: newPasswordHash,
      resetPasswordCodeHash: null,
      resetPasswordExpiresAt: null,
    },
  });

  return res.json({
    message: 'Contraseña actualizada correctamente.',
  });
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  register,
  login,
  googleLogin,
  me,
  forgotPassword,
  verifyResetCode,
  resetPassword,
};