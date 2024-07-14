<script setup lang="ts">
import { ref } from 'vue';
import { useListPets, useCreatePets } from '../gen/pets/pets';

const { data } = useListPets();
const { mutate } = useCreatePets();

const onButtonClick = () => {
  mutate({
    data: [
      {
        name: 'testName',
        tag: 'testTag',
      },
    ],
  });
};
</script>

<template>
  <h1>Using fetch with http client in vue query</h1>

  <div v-if="data">
    <ul>
      <li v-for="pet in data.data">
        <span>{{ pet.name }}</span>
      </li>
    </ul>
  </div>

  <button @click="onButtonClick">create</button>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
