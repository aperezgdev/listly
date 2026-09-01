# --- Build stage ---
FROM node:22-alpine AS build
WORKDIR /app

# Herramientas por si better-sqlite3 no encuentra binario precompilado y tiene que compilar
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Quitamos las dependencias de desarrollo tras compilar
RUN npm prune --omit=dev

# --- Runtime stage ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/build ./build

VOLUME ["/data"]
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:3001/healthz >/dev/null 2>&1 || exit 1

CMD ["node", "build/server/index.js"]
