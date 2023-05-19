<template>
  <p v-for="pet in pets" :key="pet.id">
    {{ pet.name }}
    <button @click.prevent="$emit(SELECT_PET_ID_EVENT, pet.id)">
      Load {{ pet.name }}
    </button>
  </p>
</template>

<script lang="ts">
import { useListPets } from '../api/endpoints/petstoreFromFileSpecWithTransformer';
import { SELECT_PET_ID_EVENT } from './../constants';

export default {
  name: 'Pets',
  emits: [SELECT_PET_ID_EVENT],
  setup() {
    const { data } = useListPets();
    return {
      pets: data,
      SELECT_PET_ID_EVENT,
    };
  },
};
</script>
