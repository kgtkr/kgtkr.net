FROM node:16-alpine

RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

ENV PORT 3000

CMD ["npm", "start"]
