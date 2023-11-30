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

/** NOTE: use below to create a sample for `useNamedParameters: true` with code that is supposed to work and pass tests, but it will require changes in Orval code generation
 * // clean ./samples/vue-query-useNamedParameters
 * await $`rm -rf ./samples/vue-query-useNamedParameters`;
 * // copy vue-query to vue-query-useNamedParameters
 * await $`cp -r ./samples/vue-query ./samples/vue-query-useNamedParameters`;
 * await $`rm -rf ./samples/vue-query-useNamedParameters/api/endpoints`;
 * await $`rm -rf ./samples/vue-query-useNamedParameters/api/model`;
 * // in `samples/vue-query-useNamedParameters/orval.config.ts` add `useNamedParameters: true` after first occurrence of `override: {`
 * await $`sed -i '0,/override: {/s/override: {/override: {\\n    useNamedParameters: true,/' ./samples/vue-query-useNamedParameters/orval.config.ts`;
 * // and replace `useListPets(params)` in `samples/vue-query-useNamedParameters/src/components/pets.vue` with `useListPets({ version: 1 }, params)`
 * await $`sed -i 's/useListPets(params)/useListPets({ version: 1 }, params)/' ./samples/vue-query-useNamedParameters/src/components/pets.vue`;
 * // and replace `useShowPetById(petId)` in `samples/vue-query-useNamedParameters/src/components/pet.vue` with `useShowPetById({ version: 1 }, petId)`
 * await $`sed -i 's/useShowPetById(petId)/useShowPetById({ version: 1 }, petId)/' ./samples/vue-query-useNamedParameters/src/components/pet.vue`;
 */
// await $`cd ./samples/vue-query-useNamedParameters && yarn && yarn generate-api`; // TODO: enable this once useNamedParameters actually works with vue-query reactivity

// await $`cd ./samples/nx-fastify-react && yarn && yarn generate-api`; // TODO: Fix error `Cannot send the message - the message port has been closed for the process 5163` and re-enable
