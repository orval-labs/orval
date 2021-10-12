#!/usr/bin/env zx

await $`cd ./samples/angular-app && yarn generate-api`;
await $`cd ./samples/basic && yarn example`;
await $`cd ./samples/react-app && yarn generate-api`;
await $`cd ./samples/react-app-with-react-query && yarn generate-api`;
await $`cd ./samples/react-app-with-swr && yarn generate-api`;
await $`cd ./samples/svelte-query && yarn generate-api`;
await $`cd ./samples/vue-query && yarn generate-api`;

await $`cd ./samples/nx-fastify-react && yarn generate-api`;
