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

const petId = ref('123');
// Keep `version` nullish (undefined) until it is set, so the generated
// per-argument `enabled` guard disables the query initially. Falsy-but-valid
// values like 0 no longer disable the query — see issue #3241.
const version = ref<number | undefined>(undefined);
setTimeout(() => {
  version.value = 1;
}, 100);
const petQuery = useShowPetById(petId, version);
const pet = computed(() => unref(petQuery?.data));
</script>
