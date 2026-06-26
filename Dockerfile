FROM node:22-alpine

ARG ORVAL_VERSION=latest

RUN npm install -g "orval@${ORVAL_VERSION}"

ENV NODE_PATH=/usr/local/lib/node_modules

WORKDIR /app

ENTRYPOINT ["orval"]
