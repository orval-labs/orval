import { Component, For, Show } from 'solid-js';
import { useListPets } from './api/endpoints/petstoreFromFileSpecWithTransformer';
import './App.css';
import logo from './logo.svg';

const App: Component = () => {
  const pets = useListPets();

  return (
    <div class="App">
      <header class="App-header">
        <img src={logo} class="App-logo" alt="logo" />
        <h1>Solid Query + Orval</h1>
        <Show
          when={!pets.isLoading && !pets.isError}
          fallback={
            <Show
              when={pets.isLoading}
              fallback={<p>Error: {pets.error?.message}</p>}
            >
              <p>Loading pets...</p>
            </Show>
          }
        >
          <div>
            <h2>Pet List ({pets.data?.length} pets)</h2>
            <ul>
              <For each={pets.data}>{(pet) => <li>{pet.name}</li>}</For>
            </ul>
          </div>
        </Show>
      </header>
    </div>
  );
};

export default App;
