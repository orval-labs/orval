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

setTimeout(() => {
  version.value = 1;
}, 100);
const petId = ref('123');
const version = ref(0);
const petQuery = useShowPetById(petId, version);
const pet = computed(() => unref(petQuery?.data));
</script>
