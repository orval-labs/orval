import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { useListPets, useCreatePets, useShowPetById } from './api/endpoints/petstore';

function PetsList() {
  const { data: pets, isLoading, error } = useListPets({ limit: '10' });

  if (isLoading) return <div>Loading pets...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Pets</h2>
      <ul>
        {pets?.map((pet) => (
          <li key={pet.id}>
            {pet.name} {pet.tag && `(${pet.tag})`}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PetDetail({ petId }: { petId: string }) {
  const { data: pet, isLoading } = useShowPetById(petId);

  if (isLoading) return <div>Loading pet...</div>;
  if (!pet) return null;

  return (
    <div>
      <h3>Pet Detail</h3>
      <p>ID: {pet.id}</p>
      <p>Name: {pet.name}</p>
      {pet.tag && <p>Tag: {pet.tag}</p>}
    </div>
  );
}

function CreatePetForm() {
  const { mutate: createPet, isPending } = useCreatePets();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createPet({
      data: {
        name: formData.get('name') as string,
        tag: formData.get('tag') as string,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Create Pet</h3>
      <input name="name" placeholder="Name" required />
      <input name="tag" placeholder="Tag" required />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create Pet'}
      </button>
    </form>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PetsList />
      <PetDetail petId="1" />
      <CreatePetForm />
    </QueryClientProvider>
  );
}

export default App;
