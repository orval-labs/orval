import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { injectListPets, injectCreatePets } from '../api/endpoints/pets/pets';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="App">
      <h1>Hello, {{ title() }}</h1>

      <header class="App-header">
        <img src="logo.svg" class="App-logo" alt="logo" />

        <div class="add-pet-form">
          <h2>Add a New Pet</h2>
          <p class="notice">
            <strong>Note:</strong> MSW mocks the API, so new pets won't persist.
            Watch the pet list reload after clicking "Add" - that's
            mutationInvalidates working!
          </p>
          <input
            [(ngModel)]="newPetName"
            placeholder="Pet name"
            [disabled]="createPetMutation.isPending()"
          />
          <button
            (click)="addPet()"
            [disabled]="!newPetName() || createPetMutation.isPending()"
          >
            {{ createPetMutation.isPending() ? 'Adding...' : 'Add Pet' }}
          </button>
          @if (createPetMutation.isError()) {
            <p class="error">Error adding pet</p>
          }
        </div>

        <h2>Pets List</h2>
        @if (pets.isPending()) {
          <p>Loading pets...</p>
        }
        @for (pet of pets.data(); track pet.id) {
          <p>{{ pet.name }}</p>
        }
        @if (pets.data()?.length === 0) {
          <p>No pets yet. Add one above!</p>
        }
      </header>
    </div>
  `,
})
export class App {
  protected readonly pets = injectListPets({ limit: '10' });

  protected readonly createPetMutation = injectCreatePets();

  protected readonly title = signal('angular-app');
  protected readonly newPetName = signal('');

  addPet() {
    const name = this.newPetName();
    if (!name) return;

    this.createPetMutation.mutate(
      { data: { name, tag: 'new' } },
      {
        onSuccess: () => {
          this.newPetName.set('');
        },
      },
    );
  }
}
