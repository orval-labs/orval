import React from 'react';
import { useListPets } from './api/endpoints/petstoreFromFileSpecWithTransformer';
import './App.css';
import logo from './logo.png';

function App() {
  const { data: pets } = useListPets();

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        {pets?.map((pet: any) => (
          <p key={pet.id}>{pet.name}</p>
        ))}
      </header>
    </div>
  );
}

export default App;
