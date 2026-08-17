import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { shareReplay } from 'rxjs';

import type { Pets } from '../api/http-both/model';
import { listPetsResource } from '../api/http-both/pets/pets.resource';
import { PetsService } from '../api/http-both/pets/pets.service';
import { DemoPageFrameComponent } from './demo-page-frame.component';
import { toLoadState } from './load-state';
import { BadgeComponent } from './ui/badge.component';
import { DemoPanelComponent } from './ui/demo-panel.component';
import { PetCardComponent } from './ui/pet-card.component';

@Component({
  selector: 'app-http-both-page',
  imports: [
    AsyncPipe,
    BadgeComponent,
    DemoPageFrameComponent,
    DemoPanelComponent,
    PetCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './http-both.page.html',
  styleUrl: './demo-page.styles.css',
})
export class HttpBothPage {
  private readonly petService = inject(PetsService);

  protected readonly highlights = [
    'retrievalClient: "both" emits an HttpClient method and an httpResource helper from the same operation',
    'PetsService.listPets() and listPetsResource() call the identical /v1/pets endpoint side by side',
    'Pick the Observable style for imperative flows, the signal style for template-driven reads',
  ] as const;

  protected readonly version = signal(1);

  protected readonly petsState$ = toLoadState<Pets>(
    this.petService.listPets('application/json', undefined, this.version()),
    [] as Pets,
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  protected readonly listResource = listPetsResource(
    'application/json',
    undefined,
    this.version,
  );

  protected readonly pets = computed<Pets>(() =>
    this.listResource.hasValue() ? this.listResource.value() : [],
  );
  protected readonly listStatus = computed(() => this.listResource.status());
  protected readonly listError = computed(
    () => this.listResource.error()?.message ?? 'Unknown error',
  );
}
