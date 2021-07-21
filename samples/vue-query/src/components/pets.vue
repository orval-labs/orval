<template>
  <p v-for="pet in pets" :key="pet.id">{{ pet.name }}</p>
</template>

<script lang="ts">
import { useListPets } from '../api/endpoints/petstoreFromFileSpecWithTransformer';

export default {
  name: 'Pets',
  setup() {
    const { data } = useListPets();
    return {
      pets: data,
    };
  },
};
</script>
