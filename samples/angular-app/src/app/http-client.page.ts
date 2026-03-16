import { AsyncPipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { shareReplay } from 'rxjs';

import type { Pet, Pets } from '../api/model';
import { PetsService } from '../api/http-client/pets/pets.service';
import { DemoPageFrameComponent } from './demo-page-frame.component';
import { toLoadState } from './load-state';
import { BadgeComponent } from './ui/badge.component';
import { DemoPanelComponent } from './ui/demo-panel.component';
import { PetCardComponent } from './ui/pet-card.component';

@Component({
  selector: 'app-http-client-page',
  imports: [
    AsyncPipe,
    JsonPipe,
    BadgeComponent,
    DemoPageFrameComponent,
    DemoPanelComponent,
    PetCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './http-client.page.html',
  styleUrl: './demo-page.styles.css',
})
export class HttpClientPage {
  private readonly petService = inject(PetsService);
  private readonly version = 1;
  private readonly petId = '1';

  protected readonly highlights = [
    'The default generated Angular HttpClient service API',
    'Observable-based request handling and status transitions',
    'Content-type overloads for text, XML, and JSON responses',
  ] as const;

  protected readonly petsState$ = toLoadState<Pets>(
    this.petService.listPets(undefined, this.version),
    [] as Pets,
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  protected readonly petTextState$ = toLoadState<string>(
    this.petService.showPetById(this.petId, 'text/plain', this.version),
    '',
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  protected readonly petXmlState$ = toLoadState<string>(
    this.petService.showPetById(this.petId, 'application/xml', this.version),
    '',
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  protected readonly petJsonState$ = toLoadState<Pet | string | undefined>(
    this.petService.showPetById(this.petId, 'application/json', this.version),
    undefined,
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
}
