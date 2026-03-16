import { AsyncPipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { shareReplay } from 'rxjs';

import type { Pets } from '../api/model-custom-params';
import { PetsService } from '../api/http-client-custom-params/pets/pets.service';
import { DemoPageFrameComponent } from './demo-page-frame.component';
import { toLoadState } from './load-state';
import { BadgeComponent } from './ui/badge.component';
import { DemoPanelComponent } from './ui/demo-panel.component';
import { PetCardComponent } from './ui/pet-card.component';

@Component({
  selector: 'app-http-client-custom-params-page',
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
      eyebrow="HttpClient variant"
      title="HttpClient with custom params"
      description="This page still uses generated HttpClient services, but it layers in a consumer-owned query params serializer for APIs that need bespoke parameter encoding."
      why="Reach for this variant when the default HttpClient client is the right fit, but your backend expects query strings that need custom serialization logic."
      [highlights]="highlights"
    >
      <div class="demo-grid">
        <app-demo-panel
          title="Configured query params"
          description="The object passed into the generated search method."
        >
          <app-badge panel-badge>serializer</app-badge>

          <pre>{{ queryParams | json }}</pre>
          <p class="panel-note">
            Powered by
            <code>src/orval/mutator/custom-params-serializer.ts</code>.
          </p>
        </app-demo-panel>

        <app-demo-panel
          title="searchPets()"
          description="Generated HttpClient method with custom query serialization."
        >
          @if (searchState$ | async; as searchState) {
            <app-badge panel-badge>Status: {{ searchState.status }}</app-badge>
          }

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
        </app-demo-panel>
      </div>
    </app-demo-page-frame>
  `,
  styles: `
    .demo-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .panel-note {
      color: var(--text-2);
      font-size: 0.9rem;
    }

    .panel-note {
      margin-top: 12px;
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

  protected readonly searchState$ = toLoadState<Pets>(
    this.petService.searchPets(this.queryParams, this.version, {
      params: {
        demoMode: 'custom-params',
      },
    }),
    [] as Pets,
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
}
