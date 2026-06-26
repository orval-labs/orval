FROM node:22-alpine

ARG ORVAL_VERSION=latest

RUN npm install -g "orval@${ORVAL_VERSION}" \
  && addgroup -g 1001 -S orval \
  && adduser -S orval -u 1001 -G orval

ENV NODE_PATH=/usr/local/lib/node_modules

WORKDIR /app

RUN chown -R orval:orval /app

USER orval

ENTRYPOINT ["orval"]
