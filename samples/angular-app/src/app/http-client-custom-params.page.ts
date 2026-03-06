import { AsyncPipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { catchError, map, of, shareReplay, startWith } from 'rxjs';

import type { Pets } from '../api/model-custom-params';
import { PetsService } from '../api/http-client-custom-params/pets/pets.service';

type LoadState<T> =
  | { status: 'loading'; data: T; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data: T; error: string };

@Component({
  selector: 'app-http-client-custom-params-page',
  imports: [AsyncPipe, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <h2>HttpClient + custom params serializer</h2>
      <p>
        This advanced example opts into a consumer-owned helper at
        <code>src/orval/mutator/custom-params-serializer.ts</code>.
      </p>

      <div class="Card">
        <h3>Configured query params</h3>
        <pre>{{ queryParams | json }}</pre>
      </div>

      <h3>searchPets()</h3>
      @if (searchState$ | async; as searchState) {
        <p>Status: {{ searchState.status }}</p>
        @if (searchState.status === 'loading') {
          <p>Loading pets…</p>
        } @else if (searchState.status === 'error') {
          <p class="Error">{{ searchState.error }}</p>
        } @else if (searchState.data.length) {
          <ul>
            @for (pet of searchState.data; track pet.id) {
              <li>{{ pet.name }}</li>
            }
          </ul>
        } @else {
          <p>No pets returned.</p>
        }
      }
    </section>
  `,
})
export class HttpClientCustomParamsPage {
  private readonly petService = inject(PetsService);
  private readonly version = 1;

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