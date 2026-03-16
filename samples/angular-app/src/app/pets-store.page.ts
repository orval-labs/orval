import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AsyncPipe, JsonPipe } from '@angular/common';
import { BehaviorSubject, shareReplay, switchMap } from 'rxjs';

import type { Pet, Pets } from '../api/model';
import { PetsService } from '../api/http-client/pets/pets.service';
import { DemoPageFrameComponent } from './demo-page-frame.component';
import { toLoadState } from './load-state';
import { BadgeComponent } from './ui/badge.component';
import { DemoPanelComponent } from './ui/demo-panel.component';
import { PetCardComponent } from './ui/pet-card.component';

@Component({
  selector: 'app-pets-store-page',
  imports: [
    AsyncPipe,
    JsonPipe,
    BadgeComponent,
    DemoPageFrameComponent,
    DemoPanelComponent,
    PetCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pets-store.page.html',
  styleUrls: ['./pets-store.page.css'],
})
export class PetsStorePage {
  private readonly petService = inject(PetsService);
  private readonly version = 1;
  private readonly petId = '1';
  private readonly refreshPets$ = new BehaviorSubject(0);

  protected readonly title = signal('HttpClient overview');
  protected readonly highlights = [
    'The default generated Angular HttpClient service shown once, without splitting the story across two overlapping pages',
    'A merged view of list fetching, content-type overloads, and createPets() mutation behavior',
    'The baseline reference point before moving on to custom params, httpResource, and Zod-backed variants',
  ] as const;

  protected readonly draftName = signal('Buddy');
  protected readonly draftTag = signal('demo');
  protected readonly createLoading = signal(false);
  protected readonly createResult = signal<{
    success: boolean;
    message: string;
  } | null>(null);

  protected readonly petsState$ = this.refreshPets$.pipe(
    switchMap(() =>
      toLoadState<Pets>(
        this.petService.listPets(undefined, this.version),
        [] as Pets,
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

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

  protected readonly canSubmitCreate = computed(
    () =>
      this.draftName().trim().length > 0 &&
      this.draftTag().trim().length > 0 &&
      !this.createLoading(),
  );

  protected updateDraftName(event: Event) {
    const target = event.target as HTMLInputElement;
    this.draftName.set(target.value);
  }

  protected updateDraftTag(event: Event) {
    const target = event.target as HTMLInputElement;
    this.draftTag.set(target.value);
  }

  protected createPet(event: Event) {
    event.preventDefault();

    const name = this.draftName().trim();
    const tag = this.draftTag().trim();

    if (!name || !tag || this.createLoading()) {
      return;
    }

    this.createLoading.set(true);
    this.createResult.set(null);

    this.petService.createPets({ name, tag }, this.version).subscribe({
      next: () => {
        this.createLoading.set(false);
        this.createResult.set({
          success: true,
          message: `Created ${name} successfully. The list was refreshed from the generated service.`,
        });
        this.refreshPets$.next(this.refreshPets$.value + 1);
      },
      error: (error: unknown) => {
        this.createLoading.set(false);
        this.createResult.set({
          success: false,
          message:
            error instanceof Error ? error.message : 'Unable to create pet.',
        });
      },
    });
  }
}
