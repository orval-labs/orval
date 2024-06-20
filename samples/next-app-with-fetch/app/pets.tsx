import { listPets } from './gen/pets/pets';

export default async function Pets() {
  const { data: pets, status } = await listPets();

  return (
    <div>
      <h1 className="text-4xl">Pets by server actions</h1>

      <ul>
        {pets.map((pet) => (
          <li key={pet.id}>{pet.name}</li>
        ))}
      </ul>

      <h2 className="text-xl">Status: {status}</h2>
    </div>
  );
}
