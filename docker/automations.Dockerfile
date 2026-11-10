FROM node:26-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/workflows/package.json packages/workflows/package.json
COPY packages/workflows/tsconfig.json packages/workflows/tsconfig.json
COPY packages/workflows/src packages/workflows/src
COPY apps/automations/package.json apps/automations/package.json
COPY apps/automations/tsconfig.json apps/automations/tsconfig.json
COPY apps/automations/src apps/automations/src
COPY apps/automations/public apps/automations/public
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @nexcode/workflows build && pnpm --filter @nexcode/automations build
FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXCODE_AUTOMATIONS_PORT=4280
WORKDIR /app
COPY --from=build /app .
EXPOSE 4280
USER node
CMD ["node","apps/automations/dist/server.js"]
