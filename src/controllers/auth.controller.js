const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../lib/prisma');
const { signToken } = require('../utils/jwt');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const registerSchema = z.object({
  name: z.string().min(2, 'El nombre es muy corto'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

const googleLoginSchema = z.object({
  credential: z.string().min(1, 'Falta el token de Google'),
});

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

async function register(req, res) {
  const data = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese email.' });
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, phone: data.phone, passwordHash },
  });

  const token = signToken({ sub: user.id, role: user.role });
  res.status(201).json({ user: toPublicUser(user), token });
}

async function login(req, res) {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
  }

  const token = signToken({ sub: user.id, role: user.role });
  res.json({ user: toPublicUser(user), token });
}

async function googleLogin(req, res) {
  const { credential } = googleLoginSchema.parse(req.body);

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ error: 'Token de Google inválido.' });
  }

  const { sub: googleId, email, name, picture } = payload;

  if (!email) {
    return res.status(400).json({ error: 'No se pudo obtener el email de la cuenta de Google.' });
  }

  // Busca por googleId primero, y si no, por email (para "linkear" una cuenta existente)
  let user = await prisma.user.findUnique({ where: { googleId } });

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Ya existía con password: le vinculamos el googleId
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, avatarUrl: user.avatarUrl || picture },
      });
    } else {
      // Usuario nuevo, sin password
      user = await prisma.user.create({
        data: {
          name: name || email.split('@')[0],
          email,
          googleId,
          avatarUrl: picture,
        },
      });
    }
  }

  const token = signToken({ sub: user.id, role: user.role });
  res.json({ user: toPublicUser(user), token });
}

async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ user: toPublicUser(user) });
}

module.exports = { register, login, googleLogin, me };