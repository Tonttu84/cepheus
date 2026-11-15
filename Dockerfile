FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN node scripts/prepare-face-model.mjs \
    && DATABASE_URL="postgresql://cepheus:cepheus-local-only@localhost:5433/cepheus" npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx prisma/seed.ts && npm start"]
