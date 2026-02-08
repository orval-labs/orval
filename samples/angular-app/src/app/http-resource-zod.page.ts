import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';

import type { Pet, Pets } from '../api/model-zod/index.zod';
import {
  listPetsResource,
  showPetByIdResource,
} from '../api/http-resource-zod/pets/pets.service';

/**
 * Demonstrates httpResource with Zod runtime validation.
 *
 * Generated functions include `{ parse: <ZodSchema>.parse }` so that
 * every HTTP response is validated at runtime through the Zod schema
 * before it reaches the component.
 */
@Component({
  selector: 'app-http-resource-zod-page',
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <h2>httpResource + Zod output</h2>
      <p>
        Signal-first fetching via httpResource with automatic Zod runtime
        validation on every response.
      </p>

      <h3>Pets (validated via Pets.parse)</h3>
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

      <h3>showPetByIdResource() (validated via Pet.parse)</h3>
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
export class HttpResourceZodPage {
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
