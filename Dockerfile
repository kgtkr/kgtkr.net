FROM --platform=$BUILDPLATFORM node:16.17.0 as builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:16.17.0-alpine

WORKDIR /app

COPY --from=builder /app/next.config.js /app
COPY --from=builder /app/.next/static /app/.next/static
COPY --from=builder /app/public /app/public

COPY --from=builder /app/.next/standalone /app

EXPOSE 3000
ENV PORT=3000 NODE_ENV=production

CMD ["node", "server.js"]
