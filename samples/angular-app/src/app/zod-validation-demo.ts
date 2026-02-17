import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { PetsService as ZodPetsService } from '../api/endpoints-zod/pets/pets.service';

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
      <h2>Zod Runtime Validation Demo</h2>
      <p class="description">
        This page uses Angular services generated with
        <code>runtimeValidation: true</code> and Zod schemas. Every HTTP
        response body goes through <code>Schema.parse()</code> before reaching
        your component.
      </p>

      <section>
        <h3>1. Search Pets (validated)</h3>
        <p class="hint">
          Calls <code>searchPets()</code> — response validated via
          <code>Pets.parse(data)</code>
        </p>
        @if (searchError()) {
          <div class="error">
            <strong>Validation Error:</strong> {{ searchError() }}
          </div>
        } @else if (searchPets().length) {
          <ul>
            @for (pet of searchPets(); track pet.id) {
              <li>
                #{{ pet.id }} — {{ pet.name }}
                @if (pet.tag) {
                  <span class="tag">[{{ pet.tag }}]</span>
                }
              </li>
            }
          </ul>
        } @else {
          <p class="loading">Loading…</p>
        }
      </section>

      <section>
        <h3>2. Show Pet By ID (multi-content-type, JSON validated)</h3>
        <p class="hint">
          Calls <code>showPetById('1', 'application/json')</code> — only the
          JSON branch runs through <code>Pet.parse(data)</code>
        </p>
        @if (showPetError()) {
          <div class="error">
            <strong>Validation Error:</strong> {{ showPetError() }}
          </div>
        } @else if (singlePet()) {
          <pre>{{ singlePet() | json }}</pre>
        } @else {
          <p class="loading">Loading…</p>
        }
      </section>

      <section>
        <h3>3. Create Pet (void response, no validation)</h3>
        <p class="hint">
          Calls <code>createPets()</code> — response is <code>void</code>, so
          <code>.parse()</code> is correctly skipped.
        </p>
        <button (click)="createPet()">Create Pet</button>
        @if (createResult()) {
          <div [class.success]="createResult()!.success" [class.error]="!createResult()!.success">
            {{ createResult()!.message }}
          </div>
        }
      </section>

      <section>
        <h3>4. Observe Modes</h3>
        <p class="hint">
          <code>events</code> and <code>response</code> observe modes skip
          validation. Only <code>body</code> mode validates.
        </p>
        @if (observeResults().length) {
          <ul>
            @for (result of observeResults(); track $index) {
              <li>
                <code>{{ result.mode }}</code>:
                {{ result.status }}
              </li>
            }
          </ul>
        } @else {
          <p class="loading">Loading…</p>
        }
      </section>
    </div>
  `,
  styles: `
    .zod-demo {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      font-family: sans-serif;
    }
    .description {
      color: #555;
      margin-bottom: 24px;
    }
    section {
      margin-bottom: 32px;
      padding: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }
    .hint {
      font-size: 0.9em;
      color: #888;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    .tag {
      color: #666;
      font-size: 0.85em;
    }
    .error {
      background: #fff3f3;
      border: 1px solid #fcc;
      padding: 8px 12px;
      border-radius: 4px;
      color: #c00;
    }
    .success {
      background: #f3fff3;
      border: 1px solid #cfc;
      padding: 8px 12px;
      border-radius: 4px;
      color: #080;
    }
    .loading {
      color: #aaa;
      font-style: italic;
    }
    pre {
      background: #f9f9f9;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
    }
    button {
      padding: 8px 16px;
      border: 1px solid #ccc;
      border-radius: 4px;
      cursor: pointer;
      background: #fff;
    }
    button:hover {
      background: #f0f0f0;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      padding: 4px 0;
    }
  `,
})
export class ZodValidationDemo implements OnInit {
  private readonly petsService = inject(ZodPetsService);

  protected readonly searchPets = signal<
    Array<{ id: number; name: string; tag?: string }>
  >([]);
  protected readonly searchError = signal<string | null>(null);

  protected readonly singlePet = signal<Record<string, unknown> | null>(null);
  protected readonly showPetError = signal<string | null>(null);

  protected readonly createResult = signal<{
    success: boolean;
    message: string;
  } | null>(null);

  protected readonly observeResults = signal<
    Array<{ mode: string; status: string }>
  >([]);

  ngOnInit() {
    // 1. Search pets — validated via Pets Zod schema
    this.petsService
      .searchPets({
        requirednullableString: null,
        requirednullableStringTwo: 'test',
      })
      .subscribe({
        next: (pets) => this.searchPets.set(pets as never),
        error: (err) =>
          this.searchError.set(
            err.name === 'ZodError'
              ? `ZodError: ${JSON.stringify(err.issues)}`
              : err.message,
          ),
      });

    // 2. Show pet by ID — multi-content-type, JSON branch validated
    this.petsService.showPetById('1', 'application/json').subscribe({
      next: (pet) => this.singlePet.set(pet as Record<string, unknown>),
      error: (err) =>
        this.showPetError.set(
          err.name === 'ZodError'
            ? `ZodError: ${JSON.stringify(err.issues)}`
            : err.message,
        ),
    });

    // 4. Observe modes — body validates, events/response do not
    const results: Array<{ mode: string; status: string }> = [];
    const updateResults = () => this.observeResults.set([...results]);

    this.petsService
      .searchPets(
        {
          requirednullableString: null,
          requirednullableStringTwo: 'test',
        },
        { observe: 'body' },
      )
      .subscribe({
        next: () => {
          results.push({ mode: 'body', status: '✅ Validated & received' });
          updateResults();
        },
        error: (err) => {
          results.push({
            mode: 'body',
            status: `❌ ${err.name}: ${err.message}`,
          });
          updateResults();
        },
      });

    this.petsService
      .searchPets(
        {
          requirednullableString: null,
          requirednullableStringTwo: 'test',
        },
        { observe: 'events' },
      )
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
            status: `❌ ${err.name}: ${err.message}`,
          });
          updateResults();
        },
      });

    this.petsService
      .searchPets(
        {
          requirednullableString: null,
          requirednullableStringTwo: 'test',
        },
        { observe: 'response' },
      )
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
            status: `❌ ${err.name}: ${err.message}`,
          });
          updateResults();
        },
      });
  }

  createPet() {
    this.createResult.set(null);
    this.petsService.createPets({ name: 'Buddy', tag: 'dog' }).subscribe({
      next: () =>
        this.createResult.set({
          success: true,
          message: 'Pet created successfully (void response, no .parse())',
        }),
      error: (err) =>
        this.createResult.set({ success: false, message: err.message }),
    });
  }
}
