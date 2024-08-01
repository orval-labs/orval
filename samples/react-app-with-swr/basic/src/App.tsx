import React, { useEffect } from 'react';
import { useListPets } from './api/endpoints/petstoreFromFileSpecWithTransformer';
import './App.css';
import { useAuthDispatch } from './auth.context';
import logo from './logo.svg';

function App() {
  const dispatch = useAuthDispatch();
  const { data: pets, mutate } = useListPets();

  useEffect(() => {
    dispatch('token');
    setTimeout(() => {
      mutate();
    }, 2000);
  }, [mutate, dispatch]);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        {pets?.map((pet) => <p key={pet.id}>{pet.name}</p>)}
      </header>
    </div>
  );
}

export default App;
