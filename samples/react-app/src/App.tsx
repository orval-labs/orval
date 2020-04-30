import React from 'react';
import { useQuery } from 'react-query';
import { useApi } from './api/useApi';
import './App.css';
import logo from './logo.png';

function App() {
  const { petstore } = useApi();
  const { data: pets } = useQuery('pets', () => petstore.listPets());

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        {pets?.data.map((pet) => (
          <p key={pet.id}>{pet.name}</p>
        ))}
      </header>
    </div>
  );
}

export default App;
