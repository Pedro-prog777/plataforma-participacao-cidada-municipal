# Imagem de produção da PPCM (Next.js). Requer PostgreSQL via DATABASE_URL.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN useradd --system --uid 1001 ppcm && mkdir -p /app/storage && chown ppcm /app/storage
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/database ./database
COPY --from=build /app/next.config.ts ./
USER ppcm
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
