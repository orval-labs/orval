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
  template: `
    <app-demo-page-frame
      eyebrow="Generated Angular service"
      title="HttpClient services"
      description="This page uses the same default generated Angular HttpClient service as Pet Store, but presents it as a method-by-method API showcase with list fetching and content-type overloads called out explicitly."
      why="Use this page when you want to inspect the raw generated service surface area, then compare it with the more product-like Pet Store overview and the advanced client variants."
      [highlights]="highlights"
    >
      <div class="demo-grid">
        <app-demo-panel
          class="panel--wide"
          title="listPets()"
          description="Generated service call returning an RxJS stream from HttpClient."
        >
          @if (petsState$ | async; as petsState) {
            <app-badge panel-badge>Status: {{ petsState.status }}</app-badge>
          }

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
        </app-demo-panel>

        <section class="panel-stack">
          <app-demo-panel
            title="showPetById()"
            description="text/plain overload"
            compact
          >
            @if (petTextState$ | async; as petTextState) {
              <app-badge panel-badge
                >Status: {{ petTextState.status }}</app-badge
              >
            }

            @if (petTextState$ | async; as petTextState) {
              @if (petTextState.status === 'error') {
                <p class="error">{{ petTextState.error }}</p>
              }
              <pre>{{ petTextState.data }}</pre>
            }
          </app-demo-panel>

          <app-demo-panel
            title="showPetById()"
            description="application/xml overload"
            compact
          >
            @if (petXmlState$ | async; as petXmlState) {
              <app-badge panel-badge
                >Status: {{ petXmlState.status }}</app-badge
              >
            }

            @if (petXmlState$ | async; as petXmlState) {
              @if (petXmlState.status === 'error') {
                <p class="error">{{ petXmlState.error }}</p>
              }
              <pre>{{ petXmlState.data | json }}</pre>
            }
          </app-demo-panel>

          <app-demo-panel
            title="showPetById()"
            description="application/json overload"
            compact
          >
            @if (petJsonState$ | async; as petJsonState) {
              <app-badge panel-badge
                >Status: {{ petJsonState.status }}</app-badge
              >
            }

            @if (petJsonState$ | async; as petJsonState) {
              @if (petJsonState.status === 'error') {
                <p class="error">{{ petJsonState.error }}</p>
              }
              <pre>{{ petJsonState.data | json }}</pre>
            }
          </app-demo-panel>
        </section>
      </div>
    </app-demo-page-frame>
  `,
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
