import { Component, For, Show } from 'solid-js';
import { useListPets, useCreatePets } from '../gen/pets/pets';

const Pets: Component = () => {
  const queryResult = useListPets();
  const mutation = useCreatePets();

  const handleCreate = () => {
    mutation.mutate({ data: [{ name: 'New Pet', tag: 'test' }] });
  };

  return (
    <div>
      <h2>Pets</h2>
      <Show when={queryResult.data}>
        <ul>
          <For each={queryResult.data!.data}>
            {(pet) => <li>{pet.name}</li>}
          </For>
        </ul>

        <button onClick={handleCreate} disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating...' : 'Create Pet'}
        </button>

        <Show when={mutation.isError}>
          <p style="color: red">Error: {mutation.error?.message}</p>
        </Show>

        <Show when={mutation.isSuccess}>
          <p style="color: green">Pet created successfully!</p>
        </Show>
      </Show>
    </div>
  );
};

export default Pets;
