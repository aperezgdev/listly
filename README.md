# Listly

Lista de la compra compartida en tiempo real. Sin cuentas: compartes una URL y cualquiera con el enlace puede ver y editar.

## Stack

- **Backend**: Node.js + Fastify + better-sqlite3 + Socket.IO (un solo proceso).
- **Frontend**: React + Vite (SPA servida por el mismo proceso).
- **Tiempo real**: Socket.IO con una room por sesión.

## Desarrollo local

```bash
npm install
npm run dev
```

- Frontend (Vite): http://localhost:5173
- Backend: http://localhost:3000 (Vite proxya `/api` y `/socket.io`)

Para probar en producción sin Docker:

```bash
npm run build
npm start
```

## Despliegue con Docker Compose

```bash
docker compose up -d --build
```

Esto construye la imagen, levanta el contenedor en el puerto `3000` y persiste la base de datos en el volumen `listly-data`.

```bash
docker compose logs -f     # ver logs
docker compose down        # parar (conserva el volumen)
```

## Despliegue en Dokploy

1. Sube el repo a un Git al que Dokploy tenga acceso.
2. Crea una **Application** nueva desde el repo (detecta el `Dockerfile` automáticamente).
3. Configura:
   - **Dominio**: `listly.aperezg.dev` → puerto `3000`.
   - **Volumen**: crea un volumen (p. ej. `listly-data`) y móntalo en **`/data`**.
   - **Healthcheck**: se incluye en el Dockerfile (`GET /healthz`), pero puedes añadir el mismo check en la UI.
4. Despliega. Traefik gestiona HTTPS y el upgrade de WebSockets sin configuración extra.

## Variables de entorno

| Variable   | Por defecto | Descripción                     |
| ---------- | ----------- | ------------------------------- |
| `PORT`     | `3000`      | Puerto en el que escucha Node   |
| `DATA_DIR` | `/data`     | Carpeta donde vive `listly.db`  |

## API

| Método | Ruta                       | Descripción                          |
| ------ | -------------------------- | ------------------------------------ |
| GET    | `/healthz`                 | Healthcheck                          |
| POST   | `/api/sessions`            | Crea una sesión (`{ name? }`)        |
| GET    | `/api/sessions/:token`     | Snapshot de la sesión + sus ítems    |
| PATCH  | `/api/sessions/:token`     | Renombra la sesión (`{ name }`)      |
| DELETE | `/api/sessions/:token`     | Borra la sesión para todos           |

Las mutaciones de ítems viajan por Socket.IO (eventos `item:create`, `item:update`, `item:delete`).
