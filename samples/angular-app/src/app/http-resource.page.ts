import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';

import type { Pet, Pets } from '../api/model';
import {
  listPetsResource,
  showPetByIdResource,
} from '../api/http-resource/pets/pets.service';

@Component({
  selector: 'app-http-resource-page',
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <h2>httpResource output</h2>
      <p>Signal-first fetching via httpResource.</p>

      <h3>Pets</h3>
      <p>Status: {{ listStatus() }}</p>
      @if (listResource.isLoading()) {
        <p>Loading pets…</p>
      } @else if (listResource.error()) {
        <p class="Error">Failed to load pets: {{ listError() }}</p>
      } @else if (pets().length) {
        <ul>
          @for (pet of pets(); track pet) {
            <li>{{ pet.name }}</li>
          }
        </ul>
      } @else {
        <p>No pets returned.</p>
      }

      <h3>showPetByIdResource()</h3>
      <p>Status: {{ petStatus() }}</p>
      @if (petByIdResource.isLoading()) {
        <p>Loading pet…</p>
      } @else if (petByIdResource.error()) {
        <p class="Error">Failed to load pet: {{ petError() }}</p>
      }
      <div class="Card">
        <h4>Result</h4>
        <pre>{{ petByIdDisplay() }}</pre>
      </div>
      <div class="Card">
        <h4>Raw value</h4>
        <pre>{{ petByIdRaw() | json }}</pre>
      </div>
    </section>
  `,
})
export class HttpResourcePage {
  protected readonly version = signal(1);
  protected readonly petId = signal('1');

  protected readonly listResource = listPetsResource(undefined, this.version);
  protected readonly petByIdResource = showPetByIdResource(
    this.petId,
    this.version,
  );

  protected readonly pets = computed<Pets>(
    () => this.listResource.value() ?? [],
  );
  protected readonly listStatus = computed(() => this.listResource.status());
  protected readonly listError = computed(
    () => this.listResource.error()?.message ?? 'Unknown error',
  );

  protected readonly petByIdRaw = computed<Pet | string | undefined>(() =>
    this.petByIdResource.value(),
  );
  protected readonly petStatus = computed(() => this.petByIdResource.status());
  protected readonly petError = computed(
    () => this.petByIdResource.error()?.message ?? 'Unknown error',
  );

  protected readonly petByIdDisplay = computed(() => {
    const value = this.petByIdResource.value();
    if (!value) return 'Loading…';
    return typeof value === 'string' ? value : `${value.name} (#${value.id})`;
  });
}
