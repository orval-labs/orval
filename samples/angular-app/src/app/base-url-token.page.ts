import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { shareReplay } from 'rxjs';

import type { Pets } from '../api/base-url-token/model';
import { PETSTORE_BASE_URL } from '../api/base-url-token/petstore.base-url';
import { listPetsResource } from '../api/base-url-token/pets/pets.resource';
import { PetsService } from '../api/base-url-token/pets/pets.service';
import { DemoPageFrameComponent } from './demo-page-frame.component';
import { toLoadState } from './load-state';
import { BadgeComponent } from './ui/badge.component';
import { DemoPanelComponent } from './ui/demo-panel.component';
import { PetCardComponent } from './ui/pet-card.component';

@Component({
  selector: 'app-base-url-token-page',
  imports: [
    AsyncPipe,
    BadgeComponent,
    DemoPageFrameComponent,
    DemoPanelComponent,
    PetCardComponent,
  ],
  // No providers here on purpose: `providePetstoreBaseUrl('/gateway/petstore')`
  // is registered once at application root in `app.config.ts`, which is where
  // it belongs. The generated services are `providedIn: 'root'`, so a
  // component-level override would never reach them.
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './base-url-token.page.html',
  styleUrl: './demo-page.styles.css',
})
export class BaseUrlTokenPage {
  private readonly petService = inject(PetsService);
  protected readonly resolvedBaseUrl = inject(PETSTORE_BASE_URL);

  protected readonly highlights = [
    'A single providePetstoreBaseUrl() call redirects every generated call site',
    'Both the HttpClient service and the httpResource function read the same DI token',
    'The embedded absolute spec URL is overridden with a same-origin gateway path',
  ] as const;

  protected readonly version = signal(1);

  protected readonly petsState$ = toLoadState<Pets>(
    this.petService.listPets('application/json', undefined, 1),
    [] as Pets,
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  protected readonly listResource = listPetsResource(
    'application/json',
    undefined,
    this.version,
  );
}
