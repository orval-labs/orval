import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';

import type { PetOutput, PetsOutput } from '../api/model-zod/index.zod';
import {
  listPetsResource,
  showPetByIdResource,
} from '../api/http-resource-zod/pets/pets.service';
import { DemoPageFrameComponent } from './demo-page-frame.component';
import { PetCardComponent } from './ui/pet-card.component';

/**
 * Demonstrates httpResource usage with Zod-generated model types.
 *
 * The generated resource functions still return Angular's native
 * `HttpResourceRef`, so templates and computed values should guard
 * `value()` reads with `hasValue()`.
 */
@Component({
  selector: 'app-http-resource-zod-page',
  imports: [JsonPipe, DemoPageFrameComponent, PetCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-demo-page-frame
      eyebrow="Signal-first + schema-backed types"
      title="httpResource + Zod"
      description="This page showcases generated httpResource helpers together with Zod-derived model types, combining signal-first fetching with schema-backed values that are easier to trust in the UI."
      why="Choose this variant when you want Angular's resource ergonomics while keeping the generated types closely aligned with your Zod schema layer."
      badge="ZOD"
      [highlights]="highlights"
    >
      <div class="demo-grid">
        <section class="panel panel--wide">
          <div class="panel-header">
            <div>
              <h2>listPetsResource()</h2>
              <p>Resource output typed from the generated Zod models.</p>
            </div>
            <span class="status-pill">Status: {{ listStatus() }}</span>
          </div>

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
        </section>

        <section class="panel-stack">
          <article class="panel">
            <div class="panel-header compact">
              <div>
                <h2>showPetByIdResource()</h2>
                <p>Friendly summary computed from the resource value.</p>
              </div>
              <span class="status-pill">Status: {{ petStatus() }}</span>
            </div>

            @if (petByIdResource.isLoading()) {
              <p class="muted">Loading pet…</p>
            } @else if (petByIdResource.error()) {
              <p class="error">Failed to load pet: {{ petError() }}</p>
            }
            <pre>{{ petByIdDisplay() }}</pre>
          </article>

          <article class="panel">
            <div class="panel-header compact">
              <div>
                <h2>Raw resource value</h2>
                <p>The exact value returned from the typed resource.</p>
              </div>
            </div>

            <pre>{{ petByIdRaw() | json }}</pre>
          </article>
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

    .panel-header p {
      color: var(--text-2);
      font-size: 0.9rem;
    }

    .status-pill {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--accent);
      background: var(--accent-dim);
      border: 1px solid var(--accent-glow);
      border-radius: 999px;
      padding: 4px 10px;
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
export class HttpResourceZodPage {
  protected readonly highlights = [
    'Signal-based resource helpers generated for Angular httpResource',
    'Types sourced from the generated Zod model layer',
    'A side-by-side comparison point with the non-Zod httpResource variant',
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

  protected readonly pets = computed<PetsOutput>(() =>
    this.listResource.hasValue() ? this.listResource.value() : [],
  );
  protected readonly listStatus = computed(() => this.listResource.status());
  protected readonly listError = computed(
    () => this.listResource.error()?.message ?? 'Unknown error',
  );

  protected readonly petByIdRaw = computed<PetOutput | string | undefined>(
    () => {
      if (!this.petByIdResource.hasValue()) {
        return undefined;
      }

      return this.petByIdResource.value();
    },
  );
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
