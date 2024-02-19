import { expectError } from 'tsd';
import { ref } from 'vue';
import { useShowPetById } from '../api/endpoints/petstoreFromFileSpecWithTransformer';

useShowPetById(null); // can pass null, query will be disabled
useShowPetById(undefined); // can pass undefined, query will be disabled
useShowPetById('123'); // can pass actual type of the petId - string, query will be enabled for non-empty string
expectError(useShowPetById(123)); // can't pass number, because petId is string according to the schema

// same as above, but with refs (for reactivity)
useShowPetById(ref(null));
useShowPetById(ref(undefined));
useShowPetById(ref('123'));
expectError(useShowPetById(ref(123)));
