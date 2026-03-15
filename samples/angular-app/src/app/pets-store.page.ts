import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AsyncPipe, JsonPipe } from '@angular/common';
import type { Observable } from 'rxjs';
import {
  BehaviorSubject,
  catchError,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';

import type { Pet, Pets } from '../api/model';
import { PetsService } from '../api/http-client/pets/pets.service';
import { DemoPageFrameComponent } from './demo-page-frame.component';
import { PetCardComponent } from './ui/pet-card.component';

type LoadState<T> =
  | { status: 'loading'; data: T; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data: T; error: string };

@Component({
  selector: 'app-pets-store-page',
  imports: [AsyncPipe, JsonPipe, DemoPageFrameComponent, PetCardComponent],
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
          <section class="panel panel--wide">
            <div class="panel-header">
              <div>
                <h2>listPets()</h2>
                <p>
                  Friendly baseline UI rendered from the default generated
                  HttpClient service.
                </p>
              </div>
              @if (petsState$ | async; as petsState) {
                <span class="status-pill">Status: {{ petsState.status }}</span>
              }
            </div>

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
          </section>

          <section class="panel-stack">
            <article class="panel">
              <div class="panel-header compact">
                <div>
                  <h2>createPets()</h2>
                  <p>
                    Use the generated mutation to add a pet to the in-browser
                    demo store.
                  </p>
                </div>
                <span class="status-pill">Mutation</span>
              </div>

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
            </article>

            <article class="panel">
              <div class="panel-header compact">
                <div>
                  <h2>showPetById()</h2>
                  <p>
                    Compare the generated content-type overloads in one place.
                  </p>
                </div>
                <span class="status-pill">Overloads</span>
              </div>

              <div class="overload-stack">
                <section class="overload-card">
                  <div class="overload-meta">
                    <h3>text/plain</h3>
                    @if (petTextState$ | async; as petTextState) {
                      <span class="mini-status">{{ petTextState.status }}</span>
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
                      <span class="mini-status">{{ petXmlState.status }}</span>
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
                      <span class="mini-status">{{ petJsonState.status }}</span>
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
            </article>
          </section>
        </div>

        <div class="devnote">
          <span class="devnote-badge">DEV</span>
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

  private createLoadState$<T>(
    source: Observable<T>,
    initialValue: T,
  ): Observable<LoadState<T>> {
    return source.pipe(
      map((data) => ({ status: 'success', data }) as LoadState<T>),
      startWith({ status: 'loading', data: initialValue } as LoadState<T>),
      catchError((error: unknown) =>
        of({
          status: 'error',
          data: initialValue,
          error: error instanceof Error ? error.message : 'Unknown error',
        } as LoadState<T>),
      ),
    );
  }

  protected readonly petsState$ = this.refreshPets$.pipe(
    switchMap(() =>
      this.createLoadState$<Pets>(
        this.petService.listPets(undefined, this.version),
        [] as Pets,
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected readonly petTextState$ = this.createLoadState$<string>(
    this.petService.showPetById(this.petId, 'text/plain', this.version),
    '',
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  protected readonly petXmlState$ = this.createLoadState$<string>(
    this.petService.showPetById(this.petId, 'application/xml', this.version),
    '',
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  protected readonly petJsonState$ = this.createLoadState$<
    Pet | string | undefined
  >(
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
