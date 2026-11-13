FROM mcr.microsoft.com/playwright:v1.50.0-noble

# Hugging Face Spaces runs containers as non-root user ID 1000
USER root
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npx playwright install chromium

COPY src ./src
COPY worker ./worker

RUN chown -R 1000:1000 /app
USER 1000

EXPOSE 7860

CMD ["node", "worker/bms-worker.mjs"]