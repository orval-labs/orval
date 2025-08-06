import { Component, effect, signal } from '@angular/core';
import {
  getListPetsQueryOptions,
  injectListPets,
} from '../api/endpoints/pets/pets';
import {
  DataTag,
  dataTagSymbol,
  injectQuery,
} from '@tanstack/angular-query-experimental';
import { Pets } from '../api/model';

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
  protected readonly petsDirectlyInjected = injectListPets();
  protected readonly pets = injectQuery(() => {
    const options = getListPetsQueryOptions();
    options.queryKey = ['pets'];
    return getListPetsQueryOptions();
  });

  protected readonly title = signal('angular-app');
}
