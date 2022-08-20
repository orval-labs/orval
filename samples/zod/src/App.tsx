import { useEffect, useState } from 'react';
import { z } from 'zod';
import { createPetsBody } from './petstore';
import './App.css';
import logo from './logo.svg';

function App() {
  const [pet, setPet] = useState<z.infer<typeof createPetsBody>>();
  useEffect(() => {
    setPet(
      createPetsBody.parse({
        name: 'test',
        tag: 'tag',
      }),
    );
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <span>pet: {pet?.name}</span>
      </header>
    </div>
  );
}

export default App;
