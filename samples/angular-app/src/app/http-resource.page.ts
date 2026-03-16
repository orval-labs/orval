import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';

import type { Pet, Pets } from '../api/model';
import {
  listPetsResource,
  showPetByIdResource,
} from '../api/http-resource/pets/pets.service';
import { DemoPageFrameComponent } from './demo-page-frame.component';
import { BadgeComponent } from './ui/badge.component';
import { DemoPanelComponent } from './ui/demo-panel.component';
import { PetCardComponent } from './ui/pet-card.component';

@Component({
  selector: 'app-http-resource-page',
  imports: [
    JsonPipe,
    BadgeComponent,
    DemoPageFrameComponent,
    DemoPanelComponent,
    PetCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-demo-page-frame
      eyebrow="Signal-first generated resources"
      title="httpResource services"
      description="This page showcases generated Angular resources built on httpResource, where request state, values, and errors are exposed as signals instead of observables you subscribe to manually."
      why="Use this variant when you want Angular-native signal ergonomics and a resource-style API that fits computed state and template reads naturally."
      [highlights]="highlights"
    >
      <div class="demo-grid">
        <app-demo-panel
          class="panel--wide"
          title="listPetsResource()"
          description="Signal-backed list resource for the generated pets endpoint."
        >
          <app-badge panel-badge>Status: {{ listStatus() }}</app-badge>

          @if (listResource.isLoading()) {
            <p class="muted">Loading pets…</p>
          } @else if (listResource.error()) {
            <p class="error">Failed to load pets: {{ listError() }}</p>
          } @else if (pets().length) {
            <div
              class="pet-grid"
              role="list"
              aria-label="Pets list from listPetsResource()"
            >
              @for (pet of pets(); track pet.id) {
                <app-pet-card [pet]="pet" />
              }
            </div>
          } @else {
            <p class="muted">No pets returned.</p>
          }
        </app-demo-panel>

        <section class="panel-stack">
          <app-demo-panel
            title="showPetByIdResource()"
            description="Readable computed summary"
            compact
          >
            <app-badge panel-badge>Status: {{ petStatus() }}</app-badge>

            @if (petByIdResource.isLoading()) {
              <p class="muted">Loading pet…</p>
            } @else if (petByIdResource.error()) {
              <p class="error">Failed to load pet: {{ petError() }}</p>
            }
            <pre>{{ petByIdDisplay() }}</pre>
          </app-demo-panel>

          <app-demo-panel
            title="Raw resource value"
            description="The value exposed by the generated resource."
            compact
          >
            <pre>{{ petByIdRaw() | json }}</pre>
          </app-demo-panel>
        </section>
      </div>
    </app-demo-page-frame>
  `,
  styles: `
    .demo-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(320px, 1fr);
      gap: 16px;
      align-items: start;
    }

    .panel-stack {
      display: grid;
      gap: 16px;
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
    }

    @media (max-width: 860px) {
      .demo-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class HttpResourcePage {
  protected readonly highlights = [
    'Generated listPetsResource() and showPetByIdResource() helpers',
    'Signal-based loading, error, and value access without manual subscriptions',
    'Computed state that reads naturally inside Angular templates',
  ] as const;

  protected readonly version = signal(1);
  protected readonly petId = signal('1');

  protected readonly listResource = listPetsResource(
    'application/json',
    undefined,
    this.version,
  );
  protected readonly petByIdResource = showPetByIdResource(
    this.petId,
    'application/json',
    this.version,
  );

  protected readonly pets = computed<Pets>(() =>
    this.listResource.hasValue() ? this.listResource.value() : [],
  );
  protected readonly listStatus = computed(() => this.listResource.status());
  protected readonly listError = computed(
    () => this.listResource.error()?.message ?? 'Unknown error',
  );

  protected readonly petByIdRaw = computed<Pet | string | undefined>(() => {
    if (!this.petByIdResource.hasValue()) {
      return undefined;
    }

    return this.petByIdResource.value();
  });
  protected readonly petStatus = computed(() => this.petByIdResource.status());
  protected readonly petError = computed(
    () => this.petByIdResource.error()?.message ?? 'Unknown error',
  );

  protected readonly petByIdDisplay = computed(() => {
    if (!this.petByIdResource.hasValue()) {
      return this.petByIdResource.error() ? 'Failed to load pet' : 'Loading…';
    }

    const value = this.petByIdResource.value();
    return typeof value === 'string' ? value : `${value.name} (#${value.id})`;
  });
}
