import React, { useEffect } from 'react';
import './App.css';
import { useAuthDispatch } from './auth.context';
import logo from './logo.svg';
import { useQuery } from './trpc';

function App() {
  const dispatch = useAuthDispatch();
  const { data: pets, refetch } = useQuery([
    'petstore.listPets',
    { limit: undefined, version: undefined },
  ]);

  useEffect(() => {
    dispatch('token');
    setTimeout(() => {
      refetch();
    }, 2000);
  }, [refetch, dispatch]);

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
