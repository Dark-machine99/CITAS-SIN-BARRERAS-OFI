# Citas Médicas sin Barreras

Frontend accesible para pacientes, construido con React, TypeScript y Vite.
El backend de autenticación, perfiles, disponibilidad y citas se encuentra en
Supabase Cloud.

## Requisitos

- Node.js 24.11.x
- npm 11.x

## Configuración local

1. Copia `.env.example` como `.env.local`.
2. Configura las variables públicas del proyecto Supabase:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

No uses una clave `service_role` en este frontend.

## Comandos

```bash
npm ci
npm run dev
npm run test
npm run build
```

Vercel debe usar `npm run build` y publicar el directorio `dist`.
