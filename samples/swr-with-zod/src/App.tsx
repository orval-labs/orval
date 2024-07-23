import './App.css';

import { Pet } from './gen/models';
import { useListPets, useCreatePets } from './gen/endpoints/pets/pets';
import { createPetsBodyItem } from './gen/endpoints/pets/pets.zod';

function App() {
  const { data } = useListPets();
  const { trigger } = useCreatePets();

  const createPet = async () => {
    // For example, specifying the number 123 in the name will result in a `zod` error.
    const pet = { name: '123', tag: 'test' };

    try {
      const parsedPet = createPetsBodyItem.parse(pet);

      await trigger([parsedPet]);
    } catch (error) {
      console.log('raise error', error);
    }
  };

  return (
    <>
      <h1>pet list</h1>
      <div>
        {data?.data &&
          data.data.map((pet: Pet, index: number) => (
            <ul key={index}>
              <li>id: {pet.id}</li>
              <li>name: {pet.name}</li>
              <li>tag: {pet.tag}</li>
            </ul>
          ))}
        <button onClick={createPet}>Create Pet</button>
      </div>
    </>
  );
}

export default App;
