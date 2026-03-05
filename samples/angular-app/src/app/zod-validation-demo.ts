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
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="zod-demo">
      <div class="page-header">
        <div class="page-title-row">
          <h1 class="page-title">Runtime Validation</h1>
          <span class="badge">ZOD</span>
        </div>
        <p class="page-desc">
          Services generated with <code>runtimeValidation: true</code> pipe
          every JSON response body through <code>Schema.parse()</code> — invalid
          data throws a <code>ZodError</code> before reaching your component.
        </p>
      </div>

      <div class="panels">
        <!-- Section 1 -->
        <div class="panel">
          <div class="panel-header">
            <span class="panel-num">01</span>
            <span class="panel-title">searchPets()</span>
            <span
              class="panel-badge"
              [class.badge-error]="searchError()"
              [class.badge-ok]="!searchError() && searchPets().length"
            >
              {{
                searchError()
                  ? 'ZodError'
                  : !searchError() && searchPets().length
                    ? 'valid'
                    : '…'
              }}
            </span>
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
              <ul class="pet-list" role="list">
                @for (pet of searchPets(); track pet.id) {
                  <li class="pet-row" role="listitem">
                    <span class="pet-id">#{{ pet.id }}</span>
                    <span class="pet-name">{{ pet.name }}</span>
                    @if (pet.tag) {
                      <span class="pet-tag">{{ pet.tag }}</span>
                    }
                  </li>
                }
              </ul>
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
            <span
              class="panel-badge"
              [class.badge-error]="showPetError()"
              [class.badge-ok]="!showPetError() && singlePet()"
            >
              {{
                showPetError()
                  ? 'ZodError'
                  : !showPetError() && singlePet()
                    ? 'valid'
                    : '…'
              }}
            </span>
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
            <span class="panel-badge badge-neutral">void</span>
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
            <span class="panel-badge badge-neutral">3 requests</span>
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
    </div>
  `,
  styles: `
    .zod-demo {
      max-width: 900px;
      margin: 0 auto;
    }

    /* ── Page header ── */
    .page-header {
      margin-bottom: 36px;
    }

    .page-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }

    .page-title {
      font-family: var(--font-display);
      font-size: 2.2rem;
      font-weight: 800;
      color: var(--text);
      letter-spacing: -0.03em;
    }

    .badge {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      padding: 3px 8px;
      border-radius: 4px;
      background: var(--accent-dim);
      color: var(--accent);
      border: 1px solid var(--accent-glow);
      align-self: center;
    }

    .page-desc {
      color: var(--text-2);
      font-size: 0.9rem;
      line-height: 1.7;
      max-width: 620px;
    }

    .page-desc code {
      font-family: var(--font-mono);
      font-size: 0.82em;
      color: var(--accent);
      background: var(--accent-dim);
      padding: 1px 5px;
      border-radius: 3px;
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

    .panel-badge {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      padding: 2px 7px;
      border-radius: 3px;
      text-transform: uppercase;

      &.badge-error {
        background: var(--error-dim);
        color: var(--error);
        border: 1px solid oklch(0.68 0.22 22 / 0.3);
      }

      &.badge-ok {
        background: var(--success-dim);
        color: var(--success);
        border: 1px solid oklch(0.75 0.16 148 / 0.3);
      }

      &.badge-neutral {
        background: var(--surface);
        color: var(--text-3);
        border: 1px solid var(--border-2);
      }
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
    .pet-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .pet-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      font-size: 0.875rem;
      animation: slideIn 0.2s ease;
    }

    .pet-id {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-3);
      min-width: 28px;
    }

    .pet-name {
      font-weight: 500;
      color: var(--text);
    }

    .pet-tag {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      color: var(--accent);
      background: var(--accent-dim);
      padding: 1px 6px;
      border-radius: 3px;
      margin-left: auto;
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
    Array<{ mode: string; status: string }>
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
      .searchPets(this.DEMO_PARAMS, {
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
      .showPetById('1', 'application/json', {
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
    const results: Array<{ mode: string; status: string }> = [];
    let completed = 0;
    const totalModes = 3;

    const updateResults = () => {
      if (++completed === totalModes) {
        this.observeResults.set([...results]);
      }
    };

    // Body mode - validates
    this.petsService
      .searchPets(this.DEMO_PARAMS, {
        observe: 'body',
        params: {
          demoValidation: '1',
          demoMode: 'body',
        },
      })
      .subscribe({
        next: () => {
          results.push({
            mode: 'body',
            status: '✅ Validated & received',
          });
          updateResults();
        },
        error: (err) => {
          results.push({
            mode: 'body',
            status: `❌ ${this.formatZodError(err)}`,
          });
          updateResults();
        },
      });

    // Events mode - no validation
    this.petsService
      .searchPets(this.DEMO_PARAMS, {
        observe: 'events',
        params: {
          demoValidation: '1',
          demoMode: 'events',
        },
      })
      .subscribe({
        next: () => {
          results.push({
            mode: 'events',
            status: '✅ Received (no validation)',
          });
          updateResults();
        },
        error: (err) => {
          results.push({
            mode: 'events',
            status: `❌ ${this.formatZodError(err)}`,
          });
          updateResults();
        },
      });

    // Response mode - no validation
    this.petsService
      .searchPets(this.DEMO_PARAMS, {
        observe: 'response',
        params: {
          demoValidation: '1',
          demoMode: 'response',
        },
      })
      .subscribe({
        next: () => {
          results.push({
            mode: 'response',
            status: '✅ Received (no validation)',
          });
          updateResults();
        },
        error: (err) => {
          results.push({
            mode: 'response',
            status: `❌ ${this.formatZodError(err)}`,
          });
          updateResults();
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
