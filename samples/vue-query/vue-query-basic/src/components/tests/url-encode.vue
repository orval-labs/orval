<template></template>

<script lang="ts" setup>
import { useShowPetById } from '../../api/endpoints/petstoreFromFileSpecWithTransformer';

const props = defineProps<{ petId: string }>();
useShowPetById(props.petId);
</script>
