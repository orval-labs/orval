<template>
  <!-- <div>Query is enabled: {{ petQuery.isFetching === false && petQuery. }}</div> -->
  <div v-if="pet && petId" :key="pet.id">
    {{ petId }}
    {{ pet }}
    <span>{{ pet.name }}</span>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, unref } from 'vue';
import { useShowPetById } from '../../api/endpoints/petstoreFromFileSpecWithTransformer';

setTimeout(() => {
  version.value = 1;
}, 100);
const petId = ref('123');
const version = ref(0);
// @ts-expect-error // version has `number` type instead of `MaybeRef<number>` because of its default value of 1, still version is being trated like ref, so it works. This probably should be addressed separately
const petQuery = useShowPetById(petId, version);
const pet = computed(() => unref(petQuery?.data));
</script>
