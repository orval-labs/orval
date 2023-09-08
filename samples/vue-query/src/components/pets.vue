<template>
  <p v-for="pet in pets" :key="pet.id">
    {{ pet.name }}
    <button @click.prevent="$emit(SELECT_PET_ID_EVENT, pet.id)">
      Load {{ pet.name }}
    </button>
  </p>
</template>

<script lang="ts">
import { computed, ref } from 'vue';
import { useListPets } from '../api/endpoints/petstoreFromFileSpecWithTransformer';
import { SELECT_PET_ID_EVENT } from './../constants';

export default {
  name: 'Pets',
  emits: [SELECT_PET_ID_EVENT],
  setup() {
    const filter = ref('2');
    const params = computed(() => ({
      filter: filter.value,
    }));
    setTimeout(() => {
      console.log('filter changed');
      filter.value = '3';
    }, 3000);
    const { data } = useListPets(params);
    return {
      pets: data,
      SELECT_PET_ID_EVENT,
    };
  },
};
</script>
