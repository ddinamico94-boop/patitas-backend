const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const B = 'https://images.unsplash.com/photo-';

const reports = [
  { name: 'Luna', type: 'perro', status: 'perdido', zone: 'Yerba Buena', description: 'Perdida cerca del country en Yerba Buena. Es muy cariñosa y responde a su nombre. Tenía collar azul con chapa de identificación cuando desapareció.', breed: 'Golden Retriever', color: 'Dorada', size: 'Grande', contactName: 'María González', phone: '0381 450-1234', email: 'mgonzalez@email.com', img: `${B}1477884213360-7e9d7dcc1e48?w=900&h=600&fit=crop&auto=format` },
  { name: 'Michi', type: 'gato', status: 'encontrado', zone: 'Centro', description: 'Gato negro encontrado deambulando por el centro. Muy manso y sociable.', breed: 'Doméstico pelo corto', color: 'Negro', size: 'Mediano', contactName: 'Carlos Medina', phone: '0381 422-5678', email: 'cmedina@email.com', img: `${B}1494256997604-768d688b7f23?w=900&h=600&fit=crop&auto=format` },
  { name: 'Rocky', type: 'perro', status: 'en_calle', zone: 'Villa 9 de Julio', description: 'Perro en situación de calle visto repetidamente en la zona. Necesita atención veterinaria urgente.', breed: 'Labrador mestizo', color: 'Marrón', size: 'Grande', contactName: 'Ana Suárez', phone: '0381 435-9012', email: 'asuarez@email.com', img: `${B}1587300003388-59208cc962cb?w=900&h=600&fit=crop&auto=format` },
];

async function main() {
  const adminPassword = await bcrypt.hash('admin1234', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@patitastucuman.com' },
    update: {},
    create: {
      name: 'Admin Patitas',
      email: 'admin@patitastucuman.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });

  for (const r of reports) {
    await prisma.report.create({
      data: {
        name: r.name,
        type: r.type,
        status: r.status,
        zone: r.zone,
        description: r.description,
        breed: r.breed,
        color: r.color,
        size: r.size,
        contactName: r.contactName,
        phone: r.phone,
        email: r.email,
        userId: admin.id,
        images: { create: [{ url: r.img, order: 0 }] },
      },
    });
  }

  console.log('Seed completo. Admin: admin@patitastucuman.com / admin1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
