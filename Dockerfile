FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY database.js server.js security.js postgres-config.js ./
COPY public ./public
COPY scripts ./scripts
COPY certs ./certs

RUN mkdir -p /data/uploads && chown -R node:node /app /data

ENV NODE_ENV=production
ENV PORT=3002
ENV HOST=0.0.0.0
ENV UPLOADS_DIR=/data/uploads

USER node
EXPOSE 3002

CMD ["node", "server.js"]
