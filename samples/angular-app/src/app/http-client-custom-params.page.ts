import { AsyncPipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { catchError, map, of, shareReplay, startWith } from 'rxjs';

import type { Pets } from '../api/model-custom-params';
import { PetsService } from '../api/http-client-custom-params/pets/pets.service';
import { DemoPageFrameComponent } from './demo-page-frame.component';
import { PetCardComponent } from './ui/pet-card.component';

type LoadState<T> =
  | { status: 'loading'; data: T; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data: T; error: string };

@Component({
  selector: 'app-http-client-custom-params-page',
  imports: [AsyncPipe, JsonPipe, DemoPageFrameComponent, PetCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-demo-page-frame
      eyebrow="HttpClient variant"
      title="HttpClient with custom params"
      description="This page still uses generated HttpClient services, but it layers in a consumer-owned query params serializer for APIs that need bespoke parameter encoding."
      why="Reach for this variant when the default HttpClient client is the right fit, but your backend expects query strings that need custom serialization logic."
      [highlights]="highlights"
    >
      <div class="demo-grid">
        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>Configured query params</h2>
              <p>The object passed into the generated search method.</p>
            </div>
            <span class="status-pill">serializer</span>
          </div>

          <pre>{{ queryParams | json }}</pre>
          <p class="panel-note">
            Powered by
            <code>src/orval/mutator/custom-params-serializer.ts</code>.
          </p>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>searchPets()</h2>
              <p>
                Generated HttpClient method with custom query serialization.
              </p>
            </div>
            @if (searchState$ | async; as searchState) {
              <span class="status-pill">Status: {{ searchState.status }}</span>
            }
          </div>

          @if (searchState$ | async; as searchState) {
            @if (searchState.status === 'loading') {
              <p class="muted">Loading pets…</p>
            } @else if (searchState.status === 'error') {
              <p class="error">{{ searchState.error }}</p>
            } @else if (searchState.data.length) {
              <div
                class="pet-grid"
                role="list"
                aria-label="Pets list from searchPets()"
              >
                @for (pet of searchState.data; track pet.id) {
                  <app-pet-card [pet]="pet" />
                }
              </div>
            } @else {
              <p class="muted">No pets returned.</p>
            }
          }
        </section>
      </div>
    </app-demo-page-frame>
  `,
  styles: `
    .demo-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
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
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 14px;
    }

    .panel-header h2 {
      font-size: 1rem;
      margin-bottom: 4px;
    }

    .panel-header p,
    .panel-note {
      color: var(--text-2);
      font-size: 0.9rem;
    }

    .panel-note {
      margin-top: 12px;
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
      gap: 10px;
    }

    pre {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 14px;
    }

    pre,
    code {
      font-family: var(--font-mono);
    }

    pre {
      font-size: 0.82rem;
      line-height: 1.6;
      color: var(--text);
      overflow-x: auto;
    }

    .muted {
      color: var(--text-2);
    }

    .error {
      color: var(--error);
    }

    @media (max-width: 860px) {
      .demo-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class HttpClientCustomParamsPage {
  private readonly petService = inject(PetsService);
  private readonly version = 1;

  protected readonly highlights = [
    'The same generated HttpClient shape as the default Angular client',
    'Custom query parameter serialization for nullable and unusual params',
    'A concrete example of extending Orval output without changing consumer-facing service calls',
  ] as const;

  protected readonly queryParams = {
    requirednullableString: null,
    requirednullableStringTwo: 'demo',
  };

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

  protected readonly searchState$ = this.createLoadState$<Pets>(
    this.petService.searchPets(this.queryParams, this.version, {
      params: {
        demoMode: 'custom-params',
      },
    }),
    [] as Pets,
  );
}
