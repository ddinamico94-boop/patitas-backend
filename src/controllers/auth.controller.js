const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { z } = require('zod');
const { OAuth2Client } = require('google-auth-library');
const { Resend } = require('resend');

const prisma = require('../lib/prisma');
const { signToken } = require('../utils/jwt');

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

const resend = new Resend(
  process.env.RESEND_API_KEY
);

// ======================================================
// VALIDACIONES
// ======================================================

const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre es muy corto'),

  email: z
    .string()
    .email('Email inválido'),

  password: z
    .string()
    .min(
      6,
      'La contraseña debe tener al menos 6 caracteres'
    ),

  phone: z
    .string()
    .optional(),
});

const loginSchema = z.object({
  email: z
    .string()
    .email('Email inválido'),

  password: z
    .string()
    .min(
      1,
      'La contraseña es obligatoria'
    ),
});

const googleLoginSchema = z.object({
  credential: z
    .string()
    .min(
      1,
      'Falta el token de Google'
    ),
});

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email('Email inválido'),
});

// ======================================================
// USUARIO PÚBLICO
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

// ======================================================
// REGISTRO
// ======================================================

async function register(req, res) {
  const data =
    registerSchema.parse(req.body);

  const normalizedEmail =
    data.email
      .trim()
      .toLowerCase();

  const existing =
    await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

  if (existing) {
    return res.status(409).json({
      error:
        'Ya existe una cuenta con ese email.',
    });
  }

  const passwordHash =
    await bcrypt.hash(
      data.password,
      10
    );

  const user =
    await prisma.user.create({
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
// LOGIN EMAIL + CONTRASEÑA
// ======================================================

async function login(req, res) {
  const data =
    loginSchema.parse(req.body);

  const normalizedEmail =
    data.email
      .trim()
      .toLowerCase();

  const user =
    await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

  if (
    !user ||
    !user.passwordHash
  ) {
    return res.status(401).json({
      error:
        'Email o contraseña incorrectos.',
    });
  }

  const valid =
    await bcrypt.compare(
      data.password,
      user.passwordHash
    );

  if (!valid) {
    return res.status(401).json({
      error:
        'Email o contraseña incorrectos.',
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

async function googleLogin(
  req,
  res
) {
  const {
    credential,
  } =
    googleLoginSchema.parse(
      req.body
    );

  let payload;

  try {
    const ticket =
      await googleClient.verifyIdToken({
        idToken: credential,
        audience:
          process.env
            .GOOGLE_CLIENT_ID,
      });

    payload =
      ticket.getPayload();
  } catch (err) {
    return res.status(401).json({
      error:
        'Token de Google inválido.',
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

  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

  // Busca primero por googleId
  let user =
    await prisma.user.findUnique({
      where: {
        googleId,
      },
    });

  if (!user) {
    // Si no existe por googleId,
    // buscamos por email.
    user =
      await prisma.user.findUnique({
        where: {
          email:
            normalizedEmail,
        },
      });

    if (user) {
      // Vinculamos Google con
      // la cuenta existente.
      user =
        await prisma.user.update({
          where: {
            id: user.id,
          },

          data: {
            googleId,

            avatarUrl:
              user.avatarUrl ||
              picture,
          },
        });
    } else {
      // Creamos un usuario nuevo
      // proveniente de Google.
      user =
        await prisma.user.create({
          data: {
            name:
              name ||
              normalizedEmail
                .split('@')[0],

            email:
              normalizedEmail,

            googleId,

            avatarUrl:
              picture,
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
  const user =
    await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
    });

  if (!user) {
    return res.status(404).json({
      error:
        'Usuario no encontrado.',
    });
  }

  return res.json({
    user: toPublicUser(user),
  });
}

// ======================================================
// OLVIDÉ MI CONTRASEÑA
// ======================================================

async function forgotPassword(
  req,
  res
) {
  const {
    email,
  } =
    forgotPasswordSchema.parse(
      req.body
    );

  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

  const genericMessage =
    'Si existe una cuenta con ese email, recibirás un código de recuperación.';

  const user =
    await prisma.user.findUnique({
      where: {
        email:
          normalizedEmail,
      },
    });

  /*
   * No indicamos si el email existe
   * o no. Esto evita que alguien
   * pueda descubrir qué correos
   * están registrados.
   */
  if (!user) {
    return res.json({
      message:
        genericMessage,
    });
  }

  /*
   * Si la cuenta solamente utiliza
   * Google y nunca configuró una
   * contraseña, no enviamos código.
   *
   * Seguimos devolviendo el mismo
   * mensaje por seguridad.
   */
  if (
    !user.passwordHash &&
    user.googleId
  ) {
    return res.json({
      message:
        genericMessage,
    });
  }

  /*
   * Generamos un código aleatorio
   * entre 100000 y 999999.
   */
  const code =
    crypto
      .randomInt(
        100000,
        1000000
      )
      .toString();

  /*
   * Guardamos solamente el hash.
   * El código real solamente
   * se envía por email.
   */
  const codeHash =
    crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');

  /*
   * El código dura 10 minutos.
   */
  const expiresAt =
    new Date(
      Date.now() +
        10 * 60 * 1000
    );

  await prisma.user.update({
    where: {
      id: user.id,
    },

    data: {
      resetPasswordCodeHash:
        codeHash,

      resetPasswordExpiresAt:
        expiresAt,
    },
  });

  try {
    const {
      error,
    } =
      await resend.emails.send({
        from:
          process.env
            .EMAIL_FROM ||
          'Patitas Tucuman <no-reply@patitastucuman.com>',

        to: user.email,

        subject:
          'Código para recuperar tu cuenta | Patitas Tucuman',

        html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>
    Recuperar contraseña
  </title>
</head>

<body
  style="
    margin: 0;
    padding: 0;
    background-color: #f7f4ef;
    font-family: Arial, Helvetica, sans-serif;
    color: #2f2a27;
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
        border: 1px solid #ebe5df;
      "
    >

      <div
        style="
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 28px;
        "
      >
        🐾 Patitas Tucumán
      </div>

      <h1
        style="
          font-size: 24px;
          margin: 0 0 16px;
          color: #2f2a27;
        "
      >
        Recuperá tu contraseña
      </h1>

      <p
        style="
          font-size: 15px;
          line-height: 1.6;
          color: #6d625c;
        "
      >
        Hola ${user.name},
      </p>

      <p
        style="
          font-size: 15px;
          line-height: 1.6;
          color: #6d625c;
        "
      >
        Recibimos una solicitud para
        cambiar la contraseña de tu
        cuenta de Patitas Tucumán.
      </p>

      <p
        style="
          font-size: 15px;
          line-height: 1.6;
          color: #6d625c;
        "
      >
        Ingresá el siguiente código
        en la página:
      </p>

      <div
        style="
          margin: 28px 0;
          padding: 22px 15px;
          background-color: #f7f4ef;
          border-radius: 12px;
          text-align: center;
        "
      >

        <span
          style="
            font-size: 34px;
            font-weight: 700;
            letter-spacing: 8px;
            color: #2f2a27;
          "
        >
          ${code}
        </span>

      </div>

      <p
        style="
          font-size: 14px;
          line-height: 1.6;
          color: #6d625c;
        "
      >
        Este código vence en
        <strong>
          10 minutos
        </strong>.
      </p>

      <p
        style="
          font-size: 13px;
          line-height: 1.6;
          color: #968a83;
          margin-top: 28px;
        "
      >
        Si no solicitaste cambiar
        tu contraseña, podés ignorar
        este correo. Tu cuenta seguirá
        funcionando normalmente.
      </p>

    </div>

    <p
      style="
        text-align: center;
        font-size: 12px;
        color: #a0958e;
        margin-top: 20px;
      "
    >
      Patitas Tucumán · Tucumán,
      Argentina
    </p>

  </div>

</body>
</html>
        `,
      });

    /*
     * Resend puede devolver un
     * objeto error aunque la llamada
     * no lance una excepción.
     */
    if (error) {
      console.error(
        'Error de Resend:',
        error
      );

      /*
       * Como el email no salió,
       * invalidamos el código.
       */
      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          resetPasswordCodeHash:
            null,

          resetPasswordExpiresAt:
            null,
        },
      });

      return res
        .status(500)
        .json({
          error:
            'No pudimos enviar el código. Intentá nuevamente.',
        });
    }
  } catch (error) {
    console.error(
      'Error al enviar email de recuperación:',
      error
    );

    /*
     * También invalidamos el código
     * si ocurre una excepción.
     */
    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        resetPasswordCodeHash:
          null,

        resetPasswordExpiresAt:
          null,
      },
    });

    return res
      .status(500)
      .json({
        error:
          'No pudimos enviar el código. Intentá nuevamente.',
      });
  }

  return res.json({
    message:
      genericMessage,
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
};