import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { PetsService } from '../api/endpoints/pets/pets.service';

@Component({
  selector: 'app-root',
  imports: [AsyncPipe],
  template: `
    <div class="App">
      <h1>Hello, {{ title() }}</h1>
      <header class="App-header">
        <img src="logo.svg" class="App-logo" alt="logo" />
        @for (pet of pets$ | async; track pet) {
          <p>{{ pet.name }}</p>
        }
      </header>
    </div>
  `,
})
export class App {
  private readonly petService = inject(PetsService);
  protected readonly pets$ = this.petService.listPets();

  protected readonly title = signal('angular-app');
}
