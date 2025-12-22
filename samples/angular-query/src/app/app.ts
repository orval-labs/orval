import { Component, signal } from '@angular/core';
import { injectListPets } from '../api/endpoints/pets/pets';

@Component({
  selector: 'app-root',
  template: `
    <div class="App">
      <h1>Hello, {{ title() }}</h1>
      <header class="App-header">
        <img src="logo.svg" class="App-logo" alt="logo" />
        @for (pet of pets.data(); track pet.id) {
          <p>{{ pet.name }}</p>
        }
      </header>
    </div>
  `,
})
export class App {
  protected readonly pets = injectListPets();

  protected readonly title = signal('angular-app');
}
