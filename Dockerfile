FROM oven/bun:1.4.4 AS base
WORKDIR /app
COPY package.json bun.lock turbo.json tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN bun install --frozen-lockfile --ignore-scripts
COPY packages/contracts packages/contracts
COPY apps/api apps/api
COPY apps/web apps/web

FROM base AS api
USER bun
EXPOSE 3001
CMD ["bun", "apps/api/src/index.ts"]

FROM base AS web-build
RUN bun run --filter @loura/web build

FROM nginx:1.29-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
