FROM node:22-alpine AS builder
WORKDIR /app

# Copier les manifests d'abord (meilleur cache Docker)
COPY package*.json ./
COPY packages/frontend/package*.json ./packages/frontend/
COPY packages/backend/package*.json ./packages/backend/
# Copier le schema Prisma avant npm ci (nécessaire pour postinstall)
COPY packages/backend/prisma/schema.prisma ./packages/backend/prisma/schema.prisma

# Installer toutes les dépendances (déclenche prisma generate via postinstall)
RUN npm ci

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
# Copier le schema Prisma (nécessaire pour @prisma/client)
COPY packages/backend/prisma/schema.prisma ./packages/backend/prisma/schema.prisma

# Installer uniquement les dépendances de production (sans scripts postinstall)
RUN npm ci --omit=dev --workspace=packages/backend --ignore-scripts

# Copier le client Prisma généré depuis le builder
COPY --from=builder /app/packages/backend/node_modules/.prisma ./packages/backend/node_modules/.prisma
COPY --from=builder /app/packages/backend/node_modules/@prisma ./packages/backend/node_modules/@prisma

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
