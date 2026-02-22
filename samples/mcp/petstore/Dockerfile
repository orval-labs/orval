ARG NODE_IMAGE=node:22-bookworm-slim

FROM $NODE_IMAGE
EXPOSE 3000
WORKDIR /app
COPY . /app
RUN npm install -g bun
RUN bun install --frozen-lockfile
CMD ["bun", "run", "dev"]
