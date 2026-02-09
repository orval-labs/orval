import { Title } from '@solidjs/meta';
import { createAsync, revalidate, useAction } from '@solidjs/router';
import { Component, For, Show, createSignal } from 'solid-js';
import { SwaggerPetstore } from '~/api/endpoints/petstore';

const Home: Component = () => {
  const pets = createAsync(() => SwaggerPetstore.listPets());
  const [newPetName, setNewPetName] = createSignal('');
  const [successMessage, setSuccessMessage] = createSignal('');
  const [errorMessage, setErrorMessage] = createSignal('');
  const [isCreating, setIsCreating] = createSignal(false);

  const createPetAction = useAction(SwaggerPetstore.createPets);

  const handleCreatePet = async () => {
    const name = newPetName().trim();
    if (!name) return;

    setErrorMessage('');
    setSuccessMessage('');
    setIsCreating(true);

    try {
      await createPetAction({ name, tag: 'SolidStart' });
      setNewPetName('');
      setSuccessMessage('Pet created successfully! ✓');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);

      // Revalidate the pets list to show the new pet
      revalidate(SwaggerPetstore.listPets.key);
    } catch (error) {
      console.error('Failed to create pet:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to create pet',
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main>
      <Title>SolidStart + Orval</Title>
      <h1>🐾 Pet Store - SolidStart Example</h1>

      <section>
        <h2>Pet List</h2>
        <Show when={pets()} fallback={<p class="loading">Loading pets...</p>}>
          {(petsData) => (
            <ul>
              <For each={petsData()}>
                {(pet) => (
                  <li>
                    <strong>{pet.name}</strong>
                    {pet.tag && <span> - {pet.tag}</span>}
                  </li>
                )}
              </For>
            </ul>
          )}
        </Show>
      </section>

      <section>
        <h2>Create New Pet</h2>
        <div>
          <input
            type="text"
            placeholder="Pet name"
            value={newPetName()}
            onInput={(e) => setNewPetName(e.currentTarget.value)}
            style="padding: 0.5rem; margin-right: 0.5rem; border: 1px solid #ccc; border-radius: 4px;"
          />
          <button
            onClick={handleCreatePet}
            disabled={isCreating() || !newPetName().trim()}
          >
            {isCreating() ? 'Creating...' : 'Create Pet'}
          </button>
        </div>

        <Show when={errorMessage()}>
          <p class="error">Error: {errorMessage()}</p>
        </Show>

        <Show when={successMessage()}>
          <p class="success">{successMessage()}</p>
        </Show>
      </section>

      <style>{`
        main {
          font-family: system-ui, sans-serif;
          max-width: 800px;
          margin: 2rem auto;
          padding: 0 1rem;
        }

        section {
          margin: 2rem 0;
        }

        ul {
          list-style: none;
          padding: 0;
        }

        li {
          padding: 0.75rem;
          margin: 0.5rem 0;
          background: #f5f5f5;
          border-radius: 4px;
        }

        button {
          padding: 0.5rem 1rem;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1rem;
        }

        button:hover:not(:disabled) {
          background: #1d4ed8;
        }

        button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .error {
          color: #dc2626;
          padding: 0.5rem;
          background: #fef2f2;
          border-radius: 4px;
          margin-top: 0.5rem;
        }

        .success {
          color: #16a34a;
          padding: 0.5rem;
          background: #f0fdf4;
          border-radius: 4px;
          margin-top: 0.5rem;
        }

        .loading {
          color: #64748b;
          font-style: italic;
        }
      `}</style>
    </main>
  );
};

export default Home;
