import { HttpEventType } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { JsonPipe } from '@angular/common';
import { z } from 'zod';
import { PetsService as ZodPetsService } from '../api/endpoints-zod/pets/pets.service';
import type { Pets } from '../api/model-zod/index.zod';
import { DemoPageFrameComponent } from './demo-page-frame.component';
import { BadgeComponent } from './ui/badge.component';
import { PetCardComponent } from './ui/pet-card.component';

/**
 * Demo component showing Zod runtime validation with Angular HttpClient services.
 *
 * This uses a PetsService generated with:
 *   - `client: 'angular'`
 *   - `schemas: { type: 'zod' }`
 *   - `override.angular.runtimeValidation: true`
 *
 * Every JSON body response is piped through `Schema.parse()` in the RxJS pipeline,
 * which means invalid responses throw a ZodError at runtime.
 */
@Component({
  selector: 'app-zod-validation-demo',
  imports: [JsonPipe, BadgeComponent, DemoPageFrameComponent, PetCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-demo-page-frame
      eyebrow="Runtime validation playground"
      title="Zod runtime validation"
      description="This page showcases generated Angular HttpClient services with runtimeValidation enabled, so JSON responses are validated at runtime and malformed data throws a ZodError before it reaches your UI code."
      why="Use this mode when compile-time types are not enough and you want the generated client to guard your components against invalid backend payloads."
      badge="ZOD"
      [highlights]="highlights"
    >
      <div class="zod-demo panels">
        <!-- Section 1 -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-num">01</span>
            <span class="panel-title">searchPets()</span>
            <app-badge
              shape="tag"
              size="xs"
              [tone]="
                searchError()
                  ? 'error'
                  : searchPets().length
                    ? 'success'
                    : 'neutral'
              "
            >
              {{
                searchError()
                  ? 'ZodError'
                  : !searchError() && searchPets().length
                    ? 'valid'
                    : '…'
              }}
            </app-badge>
          </div>
          <div class="panel-meta">
            Response validated via <code>Pets.parse(data)</code>
          </div>
          <div class="panel-body">
            @if (searchError()) {
              <div class="result-error" role="alert">
                <span class="result-icon">⚠</span>
                <span>{{ searchError() }}</span>
              </div>
            } @else if (searchPets().length) {
              <div
                class="pet-grid"
                role="list"
                aria-label="Validated pets list"
              >
                @for (pet of searchPets(); track pet.id) {
                  <app-pet-card [pet]="pet" />
                }
              </div>
            } @else {
              <div class="loading" aria-busy="true">
                <span class="loading-dot"></span>
                <span class="loading-dot"></span>
                <span class="loading-dot"></span>
                <span>fetching</span>
              </div>
            }
          </div>
        </div>

        <!-- Section 2 -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-num">02</span>
            <span class="panel-title">showPetById()</span>
            <app-badge
              shape="tag"
              size="xs"
              [tone]="
                showPetError() ? 'error' : singlePet() ? 'success' : 'neutral'
              "
            >
              {{
                showPetError()
                  ? 'ZodError'
                  : !showPetError() && singlePet()
                    ? 'valid'
                    : '…'
              }}
            </app-badge>
          </div>
          <div class="panel-meta">
            Multi-content-type — JSON branch runs <code>Pet.parse(data)</code>
          </div>
          <div class="panel-body">
            @if (showPetError()) {
              <div class="result-error" role="alert">
                <span class="result-icon">⚠</span>
                <span>{{ showPetError() }}</span>
              </div>
            } @else if (singlePet()) {
              <pre class="code-block">{{ singlePet() | json }}</pre>
            } @else {
              <div class="loading" aria-busy="true">
                <span class="loading-dot"></span>
                <span class="loading-dot"></span>
                <span class="loading-dot"></span>
                <span>fetching</span>
              </div>
            }
          </div>
        </div>

        <!-- Section 3 -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-num">03</span>
            <span class="panel-title">createPets()</span>
            <app-badge shape="tag" size="xs" tone="neutral">void</app-badge>
          </div>
          <div class="panel-meta">
            Response is <code>void</code> — <code>.parse()</code> is correctly
            skipped
          </div>
          <div class="panel-body">
            <button
              class="btn"
              (click)="createPet()"
              [disabled]="createLoading()"
            >
              <span class="btn-icon">{{ createLoading() ? '⟳' : '↗' }}</span>
              {{ createLoading() ? 'Creating…' : 'Create Pet' }}
            </button>
            @if (createResult()) {
              <div
                class="result-inline"
                [class.result-ok]="createResult()!.success"
                [class.result-err]="!createResult()!.success"
                role="alert"
              >
                {{ createResult()!.success ? '✓' : '✕' }}&nbsp;{{
                  createResult()!.message
                }}
              </div>
            }
          </div>
        </div>

        <!-- Section 4 -->
        <div class="panel panel--wide">
          <div class="panel-header">
            <span class="panel-num">04</span>
            <span class="panel-title">Observe Modes</span>
            <app-badge shape="tag" size="xs" tone="neutral"
              >3 requests</app-badge
            >
          </div>
          <div class="panel-meta">
            Only <code>body</code> mode validates — <code>events</code> &amp;
            <code>response</code> skip <code>.parse()</code>
          </div>
          <div class="panel-body">
            @if (observeResults().length) {
              <div class="observe-grid" role="list">
                @for (result of observeResults(); track $index) {
                  <div
                    class="observe-row"
                    role="listitem"
                    [class.observe-error]="result.status.startsWith('❌')"
                    [class.observe-ok]="result.status.startsWith('✅')"
                  >
                    <code class="observe-mode">{{ result.mode }}</code>
                    <span class="observe-status">{{ result.status }}</span>
                  </div>
                }
              </div>
            } @else {
              <div class="loading" aria-busy="true">
                <span class="loading-dot"></span>
                <span class="loading-dot"></span>
                <span class="loading-dot"></span>
                <span>running</span>
              </div>
            }
          </div>
        </div>
      </div>
    </app-demo-page-frame>
  `,
  styles: `
    .zod-demo {
      display: grid;
      gap: 16px;
    }

    /* ── Panels ── */
    .panels {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;

      &:hover {
        border-color: var(--border-2);
        box-shadow: 0 4px 24px oklch(0 0 0 / 0.4);
      }
    }

    .panel--wide {
      grid-column: 1 / -1;
    }

    .panel-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: var(--surface-2);
      border-bottom: 1px solid var(--border);
    }

    .panel-num {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--text-3);
      letter-spacing: 0.05em;
    }

    .panel-title {
      font-family: var(--font-mono);
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text);
      flex: 1;
    }

    .panel-meta {
      padding: 8px 16px;
      font-size: 0.8rem;
      color: var(--text-3);
      border-bottom: 1px solid var(--border);
    }

    .panel-meta code {
      font-family: var(--font-mono);
      font-size: 0.8em;
      color: var(--text-2);
      background: var(--surface-2);
      padding: 1px 4px;
      border-radius: 3px;
    }

    .panel-body {
      padding: 16px;
    }

    /* ── Result states ── */
    .result-error {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: var(--error-dim);
      border: 1px solid oklch(0.68 0.22 22 / 0.3);
      border-radius: 6px;
      padding: 10px 14px;
      color: var(--error);
      font-family: var(--font-mono);
      font-size: 0.82rem;
      line-height: 1.5;
      animation: fadeIn 0.3s ease;
    }

    .result-icon {
      flex-shrink: 0;
      font-size: 1rem;
      line-height: 1.4;
    }

    /* ── Pet list ── */
    .pet-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* ── Code block ── */
    .code-block {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      line-height: 1.6;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px 14px;
      overflow-x: auto;
      color: var(--success);
    }

    /* ── Loading ── */
    .loading {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--text-3);
    }

    .loading-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--accent);
      animation: pulse 1.2s ease-in-out infinite;
      opacity: 0.6;

      &:nth-child(2) {
        animation-delay: 0.2s;
      }
      &:nth-child(3) {
        animation-delay: 0.4s;
      }
    }

    /* ── Create pet button ── */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 18px;
      background: var(--surface-2);
      border: 1px solid var(--border-2);
      border-radius: 6px;
      color: var(--text);
      font-family: var(--font-sans);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition:
        background 0.15s ease,
        border-color 0.15s ease,
        box-shadow 0.15s ease;

      &:hover:not(:disabled) {
        background: var(--accent-dim);
        border-color: var(--accent-glow);
        color: var(--accent);
        box-shadow: 0 0 12px var(--accent-glow);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
    }

    .btn-icon {
      font-size: 1rem;
      line-height: 1;
    }

    .result-inline {
      margin-top: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 0.82rem;
      animation: fadeIn 0.3s ease;

      &.result-ok {
        background: var(--success-dim);
        border: 1px solid oklch(0.75 0.16 148 / 0.3);
        color: var(--success);
      }

      &.result-err {
        background: var(--error-dim);
        border: 1px solid oklch(0.68 0.22 22 / 0.3);
        color: var(--error);
      }
    }

    /* ── Observe modes ── */
    .observe-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .observe-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 8px 14px;
      border-radius: 6px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      font-size: 0.875rem;
      animation: slideIn 0.2s ease;

      &.observe-error {
        background: var(--error-dim);
        border-color: oklch(0.68 0.22 22 / 0.3);
      }

      &.observe-ok {
        background: var(--success-dim);
        border-color: oklch(0.75 0.16 148 / 0.3);
      }
    }

    .observe-mode {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--accent);
      background: var(--accent-dim);
      padding: 1px 7px;
      border-radius: 3px;
      min-width: 70px;
      text-align: center;
    }

    .observe-status {
      color: var(--text-2);
      font-size: 0.875rem;
    }

    /* ── Animations ── */
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(-6px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 0.3;
        transform: scale(0.8);
      }
      50% {
        opacity: 1;
        transform: scale(1.2);
      }
    }

    @media (max-width: 640px) {
      .panels {
        grid-template-columns: 1fr;
      }
      .panel--wide {
        grid-column: auto;
      }
    }
  `,
})
export class ZodValidationDemo implements OnInit {
  private readonly petsService = inject(ZodPetsService);
  private readonly demoVersion = 1;

  protected readonly highlights = [
    'Generated Angular HttpClient services with runtimeValidation enabled',
    'How ZodError surfaces for invalid JSON responses before component code consumes them',
    'Which observe modes validate response bodies and which intentionally skip validation',
  ] as const;

  protected readonly searchPets = signal<Pets>([]);
  protected readonly searchError = signal<string | null>(null);

  protected readonly singlePet = signal<Record<string, unknown> | null>(null);
  protected readonly showPetError = signal<string | null>(null);

  protected readonly createLoading = signal(false);
  protected readonly createResult = signal<{
    success: boolean;
    message: string;
  } | null>(null);

  protected readonly observeResults = signal<
    { mode: string; status: string }[]
  >([]);

  private readonly DEMO_PARAMS = {
    requirednullableString: null,
    requirednullableStringTwo: 'test',
  };

  ngOnInit() {
    this.loadSearchPets();
    this.loadSinglePet();
    this.loadObserveModes();
  }

  private loadSearchPets() {
    this.petsService
      .searchPets(this.DEMO_PARAMS, this.demoVersion, {
        params: {
          demoValidation: '1',
          demoMode: 'search',
        },
      })
      .subscribe({
        next: (pets) => this.searchPets.set(pets),
        error: (err) => this.searchError.set(this.formatZodError(err)),
      });
  }

  private loadSinglePet() {
    this.petsService
      .showPetById('1', 'application/json', this.demoVersion, {
        params: {
          demoValidation: '1',
        },
      })
      .subscribe({
        next: (pet) => this.singlePet.set(pet as Record<string, unknown>),
        error: (err) => this.showPetError.set(this.formatZodError(err)),
      });
  }

  private loadObserveModes() {
    const results = new Map<string, string>();

    const updateResults = (mode: string, status: string) => {
      if (results.has(mode)) {
        return;
      }

      results.set(mode, status);

      if (results.size === 3) {
        this.observeResults.set(
          ['body', 'events', 'response'].map((orderedMode) => ({
            mode: orderedMode,
            status: results.get(orderedMode) ?? 'Pending',
          })),
        );
      }
    };

    // Body mode - validates
    this.petsService
      .searchPets(this.DEMO_PARAMS, this.demoVersion, {
        observe: 'body',
        params: {
          demoValidation: '1',
          demoMode: 'body',
        },
      })
      .subscribe({
        next: () => {
          updateResults('body', '✅ Validated & received');
        },
        error: (err) => {
          updateResults('body', `❌ ${this.formatZodError(err)}`);
        },
      });

    // Events mode - no validation
    this.petsService
      .searchPets(this.DEMO_PARAMS, this.demoVersion, {
        observe: 'events',
        params: {
          demoValidation: '1',
          demoMode: 'events',
        },
      })
      .subscribe({
        next: (event) => {
          if (event.type !== HttpEventType.Response) {
            return;
          }

          updateResults('events', '✅ Received (no validation)');
        },
        error: (err) => {
          updateResults('events', `❌ ${this.formatZodError(err)}`);
        },
      });

    // Response mode - no validation
    this.petsService
      .searchPets(this.DEMO_PARAMS, this.demoVersion, {
        observe: 'response',
        params: {
          demoValidation: '1',
          demoMode: 'response',
        },
      })
      .subscribe({
        next: () => {
          updateResults('response', '✅ Received (no validation)');
        },
        error: (err) => {
          updateResults('response', `❌ ${this.formatZodError(err)}`);
        },
      });
  }

  /**
   * Format error for display, handling both ZodError and generic errors.
   * Uses Zod 3.x best practice: instanceof z.ZodError for type-safe narrowing.
   * Reference: https://github.com/colinhacks/zod/blob/v3.24.2/ERROR_HANDLING.md
   */
  private formatZodError(err: unknown): string {
    // Proper Zod 3.x type narrowing using instanceof
    if (err instanceof z.ZodError) {
      const previewLimit = 3;
      const preview = err.issues
        .slice(0, previewLimit)
        .map((issue) => {
          const path = issue.path.length ? issue.path.join('.') : 'root';
          return `${path}: ${issue.message}`;
        })
        .join(' | ');
      const remaining = err.issues.length - previewLimit;

      return remaining > 0
        ? `ZodError (${err.issues.length} issues) — ${preview} | +${remaining} more`
        : `ZodError (${err.issues.length} issues) — ${preview}`;
    }
    // Fallback for other error types
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
  }

  createPet() {
    this.createLoading.set(true);
    this.createResult.set(null);

    this.petsService.createPets({ name: 'Buddy', tag: 'dog' }).subscribe({
      next: () => {
        this.createResult.set({
          success: true,
          message: 'Pet created successfully (void response, no .parse())',
        });
        this.createLoading.set(false);
      },
      error: (err) => {
        this.createResult.set({
          success: false,
          message: this.formatZodError(err),
        });
        this.createLoading.set(false);
      },
    });
  }
}
