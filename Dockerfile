# Build any backend app in the monorepo:
#   docker build --build-arg APP=api    -t profitflow-api    .
#   docker build --build-arg APP=worker -t profitflow-worker .
#   docker build --build-arg APP=bot    -t profitflow-bot    .
# tsup bundles each app (incl. workspace packages) into dist/index.js; only external deps remain.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
ARG APP
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @profitflow/${APP} build
# Produce a self-contained dir (package.json + dist + production node_modules).
RUN pnpm --filter @profitflow/${APP} --prod deploy --legacy /prod

FROM node:22-slim AS run
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod ./
# api=4000, worker webhook=4100 (informational; compose maps what it needs)
EXPOSE 4000 4100
CMD ["node", "dist/index.js"]
