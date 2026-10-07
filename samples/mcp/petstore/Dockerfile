ARG NODE_IMAGE=node:22-bookworm-slim

FROM $NODE_IMAGE
EXPOSE 3000
RUN npm install -g bun@1.3.9
WORKDIR /app
RUN chown node:node /app
COPY --chown=node:node . /app
USER node
RUN bun install --frozen-lockfile
CMD ["bun", "run", "dev"]
