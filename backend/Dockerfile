FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

COPY . .
RUN pnpm prisma generate

EXPOSE 3000
CMD ["pnpm", "dev"]
