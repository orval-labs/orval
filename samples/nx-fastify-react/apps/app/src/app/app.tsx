import React, { useEffect } from 'react';
import { useGetPets } from '../api/endpoints/petstoreAPI';
import { Container } from './app.style';
import logo from './logo.svg';

function App() {
  const { data: pets, refetch } = useGetPets();

  useEffect(() => {
    setTimeout(() => {
      refetch();
    }, 2000);
  }, [refetch]);

  return (
    <Container>
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        {pets?.map((pet) => <p key={pet.id}>{pet.name}</p>)}
      </header>
    </Container>
  );
}

export default App;
