#!/usr/bin/env zx

await $`cd ./samples/angular-app && yarn generate-api`;
await $`cd ./samples/basic && yarn example`;
await $`cd ./samples/react-app && yarn generate-api`;
await $`cd ./samples/react-query/basic && yarn generate-api`;
await $`cd ./samples/react-query/form-data && yarn generate-api`;
await $`cd ./samples/react-query/form-data-mutator && yarn generate-api`;
await $`cd ./samples/react-query/form-url-encoded && yarn generate-api`;
await $`cd ./samples/react-query/form-url-encoded-mutator && yarn generate-api`;
await $`cd ./samples/react-query/hook-mutator && yarn generate-api`;
await $`cd ./samples/react-app-with-swr && yarn generate-api`;
await $`cd ./samples/svelte-query && yarn generate-api`;
await $`cd ./samples/vue-query && yarn generate-api`;

await $`cd ./samples/nx-fastify-react && yarn generate-api`;
