FROM node:26-bookworm-slim
ENV NODE_ENV=production NEXCODE_HOST=0.0.0.0 NEXCODE_PORT=4173
WORKDIR /app
COPY apps/agent ./apps/agent
COPY apps/web ./apps/web
RUN mkdir -p /home/node/.nexcode /workspace && chown -R node:node /root/.nexcode /workspace
USER node
EXPOSE 4173
CMD ["node","apps/agent/server.js"]
