<template>
  <div v-if="pet && petId" :key="pet.id">
    {{ petId }}
    {{ pet }}
    <span>{{ pet.name }}</span>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, unref } from 'vue';
import { useShowPetById } from '../../api/endpoints/petstoreFromFileSpecWithTransformer';

const overridePetId = ref<string | undefined>();
setTimeout(() => {
  overridePetId.value = '123';
}, 100);
// Keep `petId` nullish (undefined) until it is set, so the generated
// `enabled` guard (`unref(petId) !== null && unref(petId) !== undefined`)
// disables the query initially. Falsy-but-valid values like '' no longer
// disable the query — see issue #3241.
const petId = computed(() => overridePetId.value);
const petQuery = useShowPetById(petId);
const pet = computed(() => unref(petQuery?.data));
</script>
