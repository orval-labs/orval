import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';

import { Pet } from './api/models/pet';
import { useListPets } from './api/endpoints/swaggerPetstore';
import { useCreatePets } from './api/endpoints/swaggerPetstore';

function App() {
  const { data } = useListPets();
  const { trigger } = useCreatePets();

  return (
    <>
      <h1>SWR with fetch client</h1>
      <div>
        {data &&
          data.map((pet: Pet, index: number) => (
            <div key={index}>
              <p>id: {pet.id}</p>
              <p>name: {pet.name}</p>
              <p>tag: {pet.tag}</p>
            </div>
          ))}
        <button
          onClick={() => {
            trigger({
              name: 'test',
              tag: 'test',
            });
          }}
        >
          Add pet
        </button>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
    </>
  );
}

export default App;
