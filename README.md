# Patitas Tucumán — Backend

API REST en Node.js + Express + Prisma + PostgreSQL (Supabase) para la app "Patitas Tucumán".

## 1. Crear el proyecto en Supabase (gratis)

1. Entrá a https://supabase.com y creá un proyecto nuevo.
2. Andá a **Project Settings → Database → Connection string** y copiá:
   - La URI de **Connection pooling** (puerto 6543) → va en `DATABASE_URL`.
   - La URI de conexión **directa** (puerto 5432) → va en `DIRECT_URL`.
3. Andá a **Storage** y creá un bucket público llamado `patitas-fotos`.
4. Andá a **Project Settings → API** y copiá `Project URL` y `service_role key` (¡no la anon key!, esa es solo para el frontend).

## 2. Configurar el backend

```bash
cd patitas-backend
npm install
cp .env.example .env
# Completá .env con los datos de Supabase y un JWT_SECRET largo y random
```

## 3. Crear las tablas y cargar datos de ejemplo

```bash
npx prisma migrate dev --name init
npm run seed
```

Esto crea un usuario admin de prueba: `admin@patitastucuman.com` / `admin1234`.

## 4. Correr en desarrollo

```bash
npm run dev
```

La API queda en `http://localhost:4000/api`.

## 5. Endpoints principales

| Método | Ruta                  | Descripción                          | Auth        |
|--------|-----------------------|---------------------------------------|-------------|
| POST   | /api/auth/register    | Registrarse                           | -           |
| POST   | /api/auth/login       | Iniciar sesión                        | -           |
| GET    | /api/auth/me          | Perfil propio                         | ✔           |
| GET    | /api/reports          | Listar reportes (filtros: status, type, zone, search, page) | - |
| GET    | /api/reports/mine     | Mis reportes                          | ✔           |
| GET    | /api/reports/:id      | Detalle de un reporte                 | -           |
| POST   | /api/reports          | Crear reporte                         | ✔           |
| PUT    | /api/reports/:id      | Editar reporte (dueño o admin)        | ✔           |
| DELETE | /api/reports/:id      | Borrar reporte (dueño o admin)        | ✔           |
| POST   | /api/uploads          | Subir fotos (form-data, campo `images`) | ✔         |
| GET    | /api/admin/stats      | KPIs y gráficos del dashboard         | ✔ (admin)   |
| GET    | /api/admin/users      | Listado de usuarios                   | ✔ (admin)   |

El token JWT se manda como header: `Authorization: Bearer <token>`.

## 6. Conectar con tu frontend de Figma

En tu proyecto de React, creá un `src/lib/api.ts` con algo así:

```ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Error en la petición');
  return res.json();
}
```

Y reemplazás el array `reports` de `src/data/mock.ts` por llamadas como:

```ts
const { items } = await apiFetch('/reports');
```

Agregá un `.env` en el frontend con `VITE_API_URL=http://localhost:4000/api`.

## 7. Desplegar gratis (Render)

1. Subí este proyecto a un repo de GitHub.
2. En https://render.com → **New → Web Service** → conectá el repo.
3. Build command: `npm install && npx prisma generate`
4. Start command: `npm start`
5. Cargá las variables de entorno del `.env` en la sección **Environment**.
6. Corré las migraciones una vez desde la consola de Render (o localmente apuntando a la DB de Supabase): `npx prisma migrate deploy`.

Listo: tu API queda pública en algo como `https://patitas-backend.onrender.com/api`.
