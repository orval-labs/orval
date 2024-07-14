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

const props = defineProps<{ petId: string }>();
const overridePetId = ref<string | undefined>();
setTimeout(() => {
  overridePetId.value = '123';
}, 100);
const petId = computed(() => overridePetId.value || props.petId);
const petQuery = useShowPetById(petId);
const pet = computed(() => unref(petQuery?.data));
</script>
