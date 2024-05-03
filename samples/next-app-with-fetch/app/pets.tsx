import { listPets } from './gen/pets/pets';

export default async function Pets() {
  const pets = await listPets();

  return (
    <div>
      <h1 className="text-4xl">Pets by server actions</h1>
      <ul>
        {pets.map((pet) => (
          <li key={pet.id}>{pet.name}</li>
        ))}
      </ul>
    </div>
  );
}
