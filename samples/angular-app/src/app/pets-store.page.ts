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
  template: `
    <app-demo-page-frame
      eyebrow="Default generated Angular service"
      [title]="title()"
      description="This merged page keeps the polished pet-list presentation while also exposing the same generated HttpClient service calls, overload behavior, and create mutation flow that used to live on a separate page."
      why="Use this page as the single source of truth for the default Angular HttpClient output, then compare it against the custom params, signal-first, and Zod-powered variants without repeating the same baseline story twice."
      [highlights]="highlights"
    >
      <div class="pets-page">
        <div class="demo-grid">
          <app-demo-panel
            class="panel--wide"
            title="listPets()"
            description="Friendly baseline UI rendered from the default generated HttpClient service."
          >
            @if (petsState$ | async; as petsState) {
              <app-badge panel-badge>Status: {{ petsState.status }}</app-badge>
            }

            @if (petsState$ | async; as petsState) {
              @if (petsState.status === 'loading') {
                <div class="loading-state" aria-live="polite">
                  <span class="loading-dot"></span>
                  <span class="loading-dot"></span>
                  <span class="loading-dot"></span>
                  <span>Loading pets…</span>
                </div>
              } @else if (petsState.status === 'error') {
                <p class="error">{{ petsState.error }}</p>
              } @else if (petsState.data.length) {
                <div class="pets-grid" role="list" aria-label="Pets list">
                  @for (pet of petsState.data; track pet.id) {
                    <app-pet-card [pet]="pet" />
                  }
                </div>
              } @else {
                <p class="muted">No pets returned.</p>
              }
            }
          </app-demo-panel>

          <section class="panel-stack">
            <app-demo-panel
              title="createPets()"
              description="Use the generated mutation to add a pet to the in-browser demo store."
              compact
            >
              <app-badge panel-badge>Mutation</app-badge>

              <form class="pet-form" (submit)="createPet($event)">
                <label class="field">
                  <span>Name</span>
                  <input
                    type="text"
                    [value]="draftName()"
                    (input)="updateDraftName($event)"
                    placeholder="Buddy"
                  />
                </label>

                <label class="field">
                  <span>Tag</span>
                  <input
                    type="text"
                    [value]="draftTag()"
                    (input)="updateDraftTag($event)"
                    placeholder="demo"
                  />
                </label>

                <button
                  class="btn"
                  type="submit"
                  [disabled]="!canSubmitCreate()"
                >
                  <span class="btn-icon">{{
                    createLoading() ? '⟳' : '+'
                  }}</span>
                  {{ createLoading() ? 'Creating…' : 'Create pet' }}
                </button>
              </form>

              @if (createResult(); as result) {
                <p
                  class="inline-result"
                  [class.success]="result.success"
                  [class.failure]="!result.success"
                >
                  {{ result.message }}
                </p>
              }
            </app-demo-panel>

            <app-demo-panel
              title="showPetById()"
              description="Compare the generated content-type overloads in one place."
              compact
            >
              <app-badge panel-badge>Overloads</app-badge>

              <div class="overload-stack">
                <section class="overload-card">
                  <div class="overload-meta">
                    <h3>text/plain</h3>
                    @if (petTextState$ | async; as petTextState) {
                      <app-badge size="xs" panel-badge>{{
                        petTextState.status
                      }}</app-badge>
                    }
                  </div>
                  @if (petTextState$ | async; as petTextState) {
                    @if (petTextState.status === 'error') {
                      <p class="error">{{ petTextState.error }}</p>
                    }
                    <pre>{{ petTextState.data }}</pre>
                  }
                </section>

                <section class="overload-card">
                  <div class="overload-meta">
                    <h3>application/xml</h3>
                    @if (petXmlState$ | async; as petXmlState) {
                      <app-badge size="xs" panel-badge>{{
                        petXmlState.status
                      }}</app-badge>
                    }
                  </div>
                  @if (petXmlState$ | async; as petXmlState) {
                    @if (petXmlState.status === 'error') {
                      <p class="error">{{ petXmlState.error }}</p>
                    }
                    <pre>{{ petXmlState.data | json }}</pre>
                  }
                </section>

                <section class="overload-card">
                  <div class="overload-meta">
                    <h3>application/json</h3>
                    @if (petJsonState$ | async; as petJsonState) {
                      <app-badge size="xs" panel-badge>{{
                        petJsonState.status
                      }}</app-badge>
                    }
                  </div>
                  @if (petJsonState$ | async; as petJsonState) {
                    @if (petJsonState.status === 'error') {
                      <p class="error">{{ petJsonState.error }}</p>
                    }
                    <pre>{{ petJsonState.data | json }}</pre>
                  }
                </section>
              </div>
            </app-demo-panel>
          </section>
        </div>

        <div class="devnote">
          <app-badge shape="tag" size="xs" tone="neutral">DEV</app-badge>
          <span>
            This single page now covers the default HttpClient story end-to-end:
            list rendering, content-type overloads, and a real createPets()
            call. The browser mock keeps created pets in memory so refreshes
            from the generated service reflect your mutation.
          </span>
        </div>
      </div>
    </app-demo-page-frame>
  `,
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
