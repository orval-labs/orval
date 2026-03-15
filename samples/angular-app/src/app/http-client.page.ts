import { AsyncPipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { catchError, map, of, shareReplay, startWith } from 'rxjs';

import type { Pet, Pets } from '../api/model';
import { PetsService } from '../api/http-client/pets/pets.service';
import { DemoPageFrameComponent } from './demo-page-frame.component';
import { PetCardComponent } from './ui/pet-card.component';

type LoadState<T> =
  | { status: 'loading'; data: T; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data: T; error: string };

@Component({
  selector: 'app-http-client-page',
  imports: [AsyncPipe, JsonPipe, DemoPageFrameComponent, PetCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-demo-page-frame
      eyebrow="Generated Angular service"
      title="HttpClient services"
      description="This page uses the same default generated Angular HttpClient service as Pet Store, but presents it as a method-by-method API showcase with list fetching and content-type overloads called out explicitly."
      why="Use this page when you want to inspect the raw generated service surface area, then compare it with the more product-like Pet Store overview and the advanced client variants."
      [highlights]="highlights"
    >
      <div class="demo-grid">
        <section class="panel panel--wide">
          <div class="panel-header">
            <div>
              <h2>listPets()</h2>
              <p>
                Generated service call returning an RxJS stream from HttpClient.
              </p>
            </div>
            @if (petsState$ | async; as petsState) {
              <span class="status-pill">Status: {{ petsState.status }}</span>
            }
          </div>

          @if (petsState$ | async; as petsState) {
            @if (petsState.status === 'loading') {
              <p class="muted">Loading pets…</p>
            } @else if (petsState.status === 'error') {
              <p class="error">{{ petsState.error }}</p>
            } @else if (petsState.data.length) {
              <div
                class="pet-grid"
                role="list"
                aria-label="Pets list from listPets()"
              >
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
                <h2>showPetById()</h2>
                <p>text/plain overload</p>
              </div>
              @if (petTextState$ | async; as petTextState) {
                <span class="status-pill"
                  >Status: {{ petTextState.status }}</span
                >
              }
            </div>

            @if (petTextState$ | async; as petTextState) {
              @if (petTextState.status === 'error') {
                <p class="error">{{ petTextState.error }}</p>
              }
              <pre>{{ petTextState.data }}</pre>
            }
          </article>

          <article class="panel">
            <div class="panel-header compact">
              <div>
                <h2>showPetById()</h2>
                <p>application/xml overload</p>
              </div>
              @if (petXmlState$ | async; as petXmlState) {
                <span class="status-pill"
                  >Status: {{ petXmlState.status }}</span
                >
              }
            </div>

            @if (petXmlState$ | async; as petXmlState) {
              @if (petXmlState.status === 'error') {
                <p class="error">{{ petXmlState.error }}</p>
              }
              <pre>{{ petXmlState.data | json }}</pre>
            }
          </article>

          <article class="panel">
            <div class="panel-header compact">
              <div>
                <h2>showPetById()</h2>
                <p>application/json overload</p>
              </div>
              @if (petJsonState$ | async; as petJsonState) {
                <span class="status-pill"
                  >Status: {{ petJsonState.status }}</span
                >
              }
            </div>

            @if (petJsonState$ | async; as petJsonState) {
              @if (petJsonState.status === 'error') {
                <p class="error">{{ petJsonState.error }}</p>
              }
              <pre>{{ petJsonState.data | json }}</pre>
            }
          </article>
        </section>
      </div>
    </app-demo-page-frame>
  `,
  styles: `
    .demo-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr);
      gap: 16px;
      align-items: start;
    }

    .panel-stack {
      display: grid;
      gap: 16px;
    }

    .panel {
      background: linear-gradient(180deg, var(--surface), var(--surface-2));
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 14px 32px oklch(0 0 0 / 0.18);
    }

    .panel-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .panel-header h2 {
      font-size: 1rem;
      margin-bottom: 4px;
    }

    .panel-header p {
      color: var(--text-2);
      font-size: 0.9rem;
    }

    .compact h2 {
      font-size: 0.95rem;
    }

    .status-pill {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--accent);
      background: var(--accent-dim);
      border: 1px solid var(--accent-glow);
      border-radius: 999px;
      padding: 4px 10px;
      text-transform: uppercase;
    }

    .pet-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px;
    }

    pre {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 14px;
    }

    pre {
      font-family: var(--font-mono);
      font-size: 0.82rem;
      line-height: 1.6;
      color: var(--text);
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .muted {
      color: var(--text-2);
    }

    .error {
      color: var(--error);
      margin-bottom: 10px;
    }

    @media (max-width: 860px) {
      .demo-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
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
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  protected readonly petsState$ = this.createLoadState$<Pets>(
    this.petService.listPets(undefined, this.version),
    [] as Pets,
  );

  protected readonly petTextState$ = this.createLoadState$<string>(
    this.petService.showPetById(this.petId, 'text/plain', this.version),
    '',
  );

  protected readonly petXmlState$ = this.createLoadState$<string>(
    this.petService.showPetById(this.petId, 'application/xml', this.version),
    '',
  );

  protected readonly petJsonState$ = this.createLoadState$<
    Pet | string | undefined
  >(
    this.petService.showPetById(this.petId, 'application/json', this.version),
    undefined,
  );
}
