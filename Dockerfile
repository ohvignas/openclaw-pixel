FROM node:22-alpine AS builder
WORKDIR /app

# Copier les manifests d'abord (meilleur cache Docker)
COPY package*.json ./
COPY packages/frontend/package*.json ./packages/frontend/
COPY packages/backend/package*.json ./packages/backend/

# Installer toutes les dépendances
RUN npm ci

# Générer le client Prisma avant le build
RUN npx prisma generate --schema=packages/backend/prisma/schema.prisma

# Copier le code source
COPY packages/ ./packages/

# Build frontend et backend
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

# Installer nginx
RUN apk add --no-cache nginx

# Copier les manifests pour npm resolve
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/

# Installer uniquement les dépendances de production
RUN npm ci --omit=dev --workspace=packages/backend

# Copier les artéfacts buildés
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/frontend/dist /app/public

# Copier la configuration nginx
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copier le script de démarrage
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 80
CMD ["/app/start.sh"]
