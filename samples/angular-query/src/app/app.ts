import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  injectListPets,
  injectCreatePets,
  injectShowPetById,
  injectDeletePet,
  injectUpdatePet,
  injectPatchPet,
} from '../api/endpoints/pets/pets';

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
            <strong>Note:</strong> MSW mocks the API, so changes won't persist.
            Watch the pet list reload after mutations - that's
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

        <h2>Pet Details (ID: 1)</h2>
        @if (pet.isPending()) {
          <p>Loading pet...</p>
        }
        @if (pet.data(); as petData) {
          <div class="pet-details">
            <p><strong>Name:</strong> {{ petData.name }}</p>
            <p><strong>Tag:</strong> {{ petData.tag || 'None' }}</p>
            <div class="pet-actions">
              <button
                (click)="updatePetDetails()"
                [disabled]="updatePetMutation.isPending()"
              >
                {{
                  updatePetMutation.isPending() ? 'Updating...' : 'Update Pet'
                }}
              </button>
              <button
                (click)="patchPetTag()"
                [disabled]="patchPetMutation.isPending()"
              >
                {{ patchPetMutation.isPending() ? 'Patching...' : 'Patch Tag' }}
              </button>
              <button
                (click)="deletePetById()"
                [disabled]="deletePetMutation.isPending()"
                class="delete-btn"
              >
                {{
                  deletePetMutation.isPending() ? 'Deleting...' : 'Delete Pet'
                }}
              </button>
            </div>
          </div>
        }

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
  protected readonly pet = injectShowPetById('1');

  protected readonly createPetMutation = injectCreatePets();
  protected readonly deletePetMutation = injectDeletePet();
  protected readonly updatePetMutation = injectUpdatePet();
  protected readonly patchPetMutation = injectPatchPet();

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

  deletePetById() {
    this.deletePetMutation.mutate({ petId: '1' });
  }

  updatePetDetails() {
    const currentPet = this.pet.data();
    if (!currentPet) return;

    this.updatePetMutation.mutate({
      petId: '1',
      data: {
        ...currentPet,
        name: currentPet.name + ' (updated)',
      },
    });
  }

  patchPetTag() {
    this.patchPetMutation.mutate({
      petId: '1',
      data: { tag: 'patched-tag' },
    });
  }
}
