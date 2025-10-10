ARG NODE_IMAGE=node:22-bookworm-slim

FROM $NODE_IMAGE
EXPOSE 3000
WORKDIR /app
COPY . /app
RUN corepack enable
RUN yarn install --frozen-lockfile
CMD ["yarn", "dev"]
