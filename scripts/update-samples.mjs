#!/usr/bin/env zx

await $`cd ./samples/angular-app && yarn && yarn generate-api`;
await $`cd ./samples/basic && yarn && yarn example`;
await $`cd ./samples/react-app && yarn && yarn generate-api`;
await $`cd ./samples/react-query/basic && yarn && yarn generate-api`;
await $`cd ./samples/react-query/custom-client && yarn && yarn generate-api`;
await $`cd ./samples/react-query/form-data && yarn && yarn generate-api`;
await $`cd ./samples/react-query/form-data-mutator && yarn && yarn generate-api`;
await $`cd ./samples/react-query/form-url-encoded && yarn && yarn generate-api`;
await $`cd ./samples/react-query/form-url-encoded-mutator && yarn && yarn generate-api`;
await $`cd ./samples/react-query/hook-mutator && yarn && yarn generate-api`;
await $`cd ./samples/react-app-with-swr && yarn && yarn generate-api`;
await $`cd ./samples/svelte-query && yarn && yarn generate-api`;
await $`cd ./samples/vue-query && yarn && yarn generate-api`;
await $`cd ./samples/trpc && yarn && yarn generate-api`;

await $`cd ./samples/nx-fastify-react && yarn && yarn generate-api`;
