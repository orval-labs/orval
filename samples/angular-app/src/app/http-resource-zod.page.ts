import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';

import type { PetOutput, PetsOutput } from '../api/model-zod/index.zod';
import {
  listPetsResource,
  showPetByIdResource,
} from '../api/http-resource-zod/pets/pets.service';
import { DemoPageFrameComponent } from './demo-page-frame.component';
import { BadgeComponent } from './ui/badge.component';
import { DemoPanelComponent } from './ui/demo-panel.component';
import { PetCardComponent } from './ui/pet-card.component';

/**
 * Demonstrates httpResource usage with Zod-generated model types.
 *
 * The generated resource functions still return Angular's native
 * `HttpResourceRef`, so templates and computed values should guard
 * `value()` reads with `hasValue()`.
 */
@Component({
  selector: 'app-http-resource-zod-page',
  imports: [
    JsonPipe,
    BadgeComponent,
    DemoPageFrameComponent,
    DemoPanelComponent,
    PetCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './http-resource-zod.page.html',
  styleUrl: './demo-page.styles.css',
})
export class HttpResourceZodPage {
  protected readonly highlights = [
    'Signal-based resource helpers generated for Angular httpResource',
    'Types sourced from the generated Zod model layer',
    'A side-by-side comparison point with the non-Zod httpResource variant',
  ] as const;

  protected readonly version = signal(1);
  protected readonly petId = signal('1');

  protected readonly listResource = listPetsResource(
    'application/json',
    undefined,
    this.version,
  );
  protected readonly petByIdResource = showPetByIdResource(
    this.petId,
    'application/json',
    this.version,
  );

  protected readonly pets = computed<PetsOutput>(() =>
    this.listResource.hasValue() ? this.listResource.value() : [],
  );
  protected readonly listStatus = computed(() => this.listResource.status());
  protected readonly listError = computed(
    () => this.listResource.error()?.message ?? 'Unknown error',
  );

  protected readonly petByIdRaw = computed<PetOutput | string | undefined>(
    () => {
      if (!this.petByIdResource.hasValue()) {
        return undefined;
      }

      return this.petByIdResource.value();
    },
  );
  protected readonly petStatus = computed(() => this.petByIdResource.status());
  protected readonly petError = computed(
    () => this.petByIdResource.error()?.message ?? 'Unknown error',
  );

  protected readonly petByIdDisplay = computed(() => {
    if (!this.petByIdResource.hasValue()) {
      return this.petByIdResource.error() ? 'Failed to load pet' : 'Loading…';
    }

    const value = this.petByIdResource.value();
    return typeof value === 'string' ? value : `${value.name} (#${value.id})`;
  });
}
