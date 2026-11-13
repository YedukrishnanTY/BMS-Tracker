FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install && npx playwright install --with-deps chromium

COPY src ./src
COPY worker ./worker

EXPOSE 10000

CMD ["node", "worker/bms-worker.mjs"]