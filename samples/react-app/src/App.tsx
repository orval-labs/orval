import React, { useEffect, useState } from 'react';
import { Pets } from './api/model';
import { useApi } from './api/useApi';
import './App.css';
import { useAuthDispatch } from './auth.context';
import logo from './logo.svg';

function App() {
  const dispatch = useAuthDispatch();
  const { listPets } = useApi();
  const [pets, setPets] = useState<Pets>([]);

  useEffect(() => {
    dispatch('token');

    setTimeout(() => {
      listPets().then(setPets);
    }, 1000);
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        {!!pets.length ? (
          pets.map((pet) => <p key={pet.id}>{pet.name}</p>)
        ) : (
          <div>...loading</div>
        )}
      </header>
    </div>
  );
}

export default App;
