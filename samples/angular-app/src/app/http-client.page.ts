import { AsyncPipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { catchError, map, of, shareReplay, startWith } from 'rxjs';

import type { Pet, Pets } from '../api/model';
import { PetsService } from '../api/http-client/pets/pets.service';

type LoadState<T> =
  | { status: 'loading'; data: T; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data: T; error: string };

@Component({
  selector: 'app-http-client-page',
  imports: [AsyncPipe, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <h2>HttpClient output</h2>
      <p>Uses generated service methods and content-type overloads.</p>

      <h3>Pets</h3>
      @if (petsState$ | async; as petsState) {
        <p>Status: {{ petsState.status }}</p>
        @if (petsState.status === 'loading') {
          <p>Loading pets…</p>
        } @else if (petsState.status === 'error') {
          <p class="Error">{{ petsState.error }}</p>
        } @else if (petsState.data.length) {
          <ul>
            @for (pet of petsState.data; track pet) {
              <li>{{ pet.name }}</li>
            }
          </ul>
        } @else {
          <p>No pets returned.</p>
        }
      }

      <h3>showPetById() overloads</h3>
      <div class="Card">
        <h4>text/plain</h4>
        @if (petTextState$ | async; as petTextState) {
          <p>Status: {{ petTextState.status }}</p>
          @if (petTextState.status === 'error') {
            <p class="Error">{{ petTextState.error }}</p>
          }
          <pre>{{ petTextState.data }}</pre>
        }
      </div>
      <div class="Card">
        <h4>application/xml</h4>
        @if (petXmlState$ | async; as petXmlState) {
          <p>Status: {{ petXmlState.status }}</p>
          @if (petXmlState.status === 'error') {
            <p class="Error">{{ petXmlState.error }}</p>
          }
          <pre>{{ petXmlState.data | json }}</pre>
        }
      </div>
      <div class="Card">
        <h4>application/json</h4>
        @if (petJsonState$ | async; as petJsonState) {
          <p>Status: {{ petJsonState.status }}</p>
          @if (petJsonState.status === 'error') {
            <p class="Error">{{ petJsonState.error }}</p>
          }
          <pre>{{ petJsonState.data | json }}</pre>
        }
      </div>
    </section>
  `,
})
export class HttpClientPage {
  private readonly petService = inject(PetsService);
  private readonly version = 1;
  private readonly petId = '1';

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

  protected readonly petXmlState$ = this.createLoadState$<Pet | undefined>(
    this.petService.showPetById(this.petId, 'application/xml', this.version),
    undefined,
  );

  protected readonly petJsonState$ = this.createLoadState$<
    Pet | string | undefined
  >(
    this.petService.showPetById(this.petId, 'application/json', this.version),
    undefined,
  );
}
