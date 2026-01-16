import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

// Main endpoint (with mocks and invalidation)
import {
  injectListPets,
  injectCreatePets,
  injectShowPetById,
  injectDeletePet,
  injectUpdatePet,
  injectPatchPet,
  getUpdatePetMutationOptions,
} from '../api/endpoints/pets/pets';

// No-transformer endpoint (native Angular HttpClient, no custom mutator)
import {
  injectListPets as injectListPetsNative,
  injectSearchPets as injectSearchPetsNative,
} from '../api/endpoints-no-transformer/pets/pets';

// Custom instance endpoint (uses custom mutator)
import { injectListPets as injectListPetsCustom } from '../api/endpoints-custom-instance/pets/pets';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="App">
      <h1>Hello, {{ title() }}</h1>

      <header class="App-header">
        <img src="logo.svg" class="App-logo" alt="logo" />

        <!-- SECTION: Main Endpoint (with mocks) -->
        <section class="section">
          <h2>📦 Main Endpoint (endpoints/pets)</h2>
          <p class="subtitle">Uses native HttpClient with mocks enabled</p>

          <div class="add-pet-form">
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

          <h3>Pet Details (ID: {{ petId() }})</h3>
          @if (pet.isPending()) {
            <p>Loading pet...</p>
          }
          @if (pet.data(); as petData) {
            <div class="pet-details">
              <p><strong>Name:</strong> {{ petData.name }}</p>
              <p><strong>Tag:</strong> {{ petData.tag || 'None' }}</p>
              <div class="pet-actions">
                <button (click)="changePetId()">Change Pet ID</button>
                <button
                  (click)="updatePetDetails()"
                  [disabled]="updatePetMutation.isPending()"
                >
                  {{ updatePetMutation.isPending() ? 'Updating...' : 'Update' }}
                </button>
                <button
                  (click)="patchPetTag()"
                  [disabled]="patchPetMutation.isPending()"
                >
                  {{ patchPetMutation.isPending() ? 'Patching...' : 'Patch' }}
                </button>
                <button
                  (click)="deletePetById()"
                  [disabled]="deletePetMutation.isPending()"
                  class="delete-btn"
                >
                  {{ deletePetMutation.isPending() ? 'Deleting...' : 'Delete' }}
                </button>
              </div>
            </div>
          }

          <h3>Pets List</h3>
          @if (pets.isPending()) {
            <p>Loading pets...</p>
          }
          @for (pet of pets.data(); track pet.id) {
            <p>{{ pet.name }}</p>
          }
          @if (pets.data()?.length === 0) {
            <p>No pets yet. Add one above!</p>
          }
        </section>

        <!-- SECTION: Reactivity Demo -->
        <section class="section">
          <h2>⚡ Reactivity Demo</h2>
          <p class="subtitle">
            Signal-based params - changing limit triggers automatic re-fetch!
          </p>

          <div class="reactivity-controls">
            <p><strong>Current Limit:</strong> {{ petsLimit() }}</p>
            <button (click)="incrementLimit()">Increase Limit (+5)</button>
          </div>

          <h3>Reactive Pets List (limit={{ petsLimit() }})</h3>
          @if (petsReactive.isPending() || petsReactive.isFetching()) {
            <p>Loading with limit={{ petsLimit() }}...</p>
          }
          @if (petsReactive.data(); as reactivePets) {
            <p class="notice">Showing {{ reactivePets.length }} pets</p>
            @for (pet of reactivePets; track pet.id) {
              <p>{{ pet.name }}</p>
            }
          }
        </section>

        <!-- SECTION: No-Transformer Endpoint (native HttpClient) -->
        <section class="section">
          <h2>🔧 No-Transformer Endpoint</h2>
          <p class="subtitle">
            endpoints-no-transformer - native HttpClient, no mocks
          </p>
          <p class="notice">
            <strong>NG0203 Bug Test:</strong> If you see pets loading, the fix
            works!
          </p>

          <h3>Native List Pets</h3>
          @if (petsNative.isPending()) {
            <p>Loading (native)...</p>
          }
          @if (petsNative.isError()) {
            <p class="error">Error: {{ petsNative.error()?.message }}</p>
          }
          @if (petsNative.data(); as data) {
            <p class="success">
              ✅ Loaded {{ data.length }} pets (native HttpClient works!)
            </p>
          }

          <h3>Native Search Pets</h3>
          @if (searchPetsNative.isPending()) {
            <p>Searching (native)...</p>
          }
          @if (searchPetsNative.isError()) {
            <p class="error">Error: {{ searchPetsNative.error()?.message }}</p>
          }
          @if (searchPetsNative.data(); as data) {
            <p class="success">
              ✅ Searched {{ data.length }} pets (native works!)
            </p>
          }
        </section>

        <!-- SECTION: Custom Instance Endpoint -->
        <section class="section">
          <h2>⚙️ Custom Instance Endpoint</h2>
          <p class="subtitle">
            endpoints-custom-instance - uses custom mutator
          </p>

          <h3>Custom List Pets</h3>
          @if (petsCustom.isPending()) {
            <p>Loading (custom)...</p>
          }
          @if (petsCustom.isError()) {
            <p class="error">Error: {{ petsCustom.error()?.message }}</p>
          }
          @if (petsCustom.data(); as data) {
            <p class="success">
              ✅ Loaded {{ data.length }} pets (custom mutator works!)
            </p>
          }
        </section>
      </header>
    </div>
  `,
  styles: [
    `
      .section {
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 1rem;
        margin: 1rem 0;
        background: #f9f9f9;
      }
      .subtitle {
        color: #666;
        font-size: 0.9rem;
        margin-top: -0.5rem;
      }
      .notice {
        background: #e7f3ff;
        padding: 0.5rem;
        border-radius: 4px;
        border-left: 4px solid #007bff;
      }
      .success {
        color: green;
        font-weight: bold;
      }
      .error {
        color: red;
      }
      .add-pet-form {
        display: flex;
        gap: 0.5rem;
        margin: 1rem 0;
      }
      .pet-actions {
        display: flex;
        gap: 0.5rem;
      }
      .delete-btn {
        background: #dc3545;
        color: white;
      }
    `,
  ],
})
export class App {
  // ============================================
  // REACTIVITY DEMO: Signal-based query params
  // ============================================

  // Static params - simple usage
  protected readonly pets = injectListPets({ limit: '10' });

  // Reactive params with getter - signal changes trigger re-fetch!
  protected readonly petsLimit = signal('10');
  protected readonly petsReactive = injectListPets(() => ({
    limit: this.petsLimit(),
  }));

  changePetId() {
    if (this.petId() === '1') {
      this.petId.set('2');
    } else {
      this.petId.set('1');
    }
  }

  // Demo: Change limit - petsReactive will automatically re-fetch
  incrementLimit() {
    const current = parseInt(this.petsLimit());
    this.petsLimit.set(String(current + 5));
  }
  // ============================================

  petId = signal('1');
  protected readonly pet = injectShowPetById(() => this.petId());
  protected readonly createPetMutation = injectCreatePets();
  protected readonly deletePetMutation = injectDeletePet();
  protected readonly updatePetMutation = injectUpdatePet();
  protected readonly patchPetMutation = injectPatchPet();

  // No-transformer endpoint (native HttpClient) - this tests the NG0203 fix!
  protected readonly petsNative = injectListPetsNative({ limit: '5' });
  protected readonly searchPetsNative = injectSearchPetsNative({
    requirednullableString: 'test',
    requirednullableStringTwo: 'dog',
  });
  // Custom instance endpoint (custom mutator)
  protected readonly petsCustom = injectListPetsCustom({ limit: '5' });

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
