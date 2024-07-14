import { useListPets, useCreatePets } from './gen/pets/pets';
import { Pet } from './gen/models';

export default function Pets() {
  const { data } = useListPets();
  const mutation = useCreatePets();

  return (
    <div>
      <h1 className="text-4xl">Pets by react-query</h1>

      <ul>
        {data && data.data.map((pet: Pet) => <li key={pet.id}>{pet.name}</li>)}
      </ul>

      <button
        onClick={() =>
          mutation.mutate({ data: [{ name: 'testName', tag: 'testTag' }] })
        }
      >
        Create a pet
      </button>
    </div>
  );
}
