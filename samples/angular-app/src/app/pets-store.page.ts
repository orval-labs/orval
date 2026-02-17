import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { AsyncPipe, NgOptimizedImage } from '@angular/common';
import { PetsService } from '../api/endpoints/pets/pets.service';

@Component({
  selector: 'app-pets-store-page',
  imports: [AsyncPipe, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pets-page">
      <div class="page-header">
        <div class="page-header-inner">
          <div class="logo-glow">
            <img ngSrc="logo.svg" width="40" height="40" priority alt="Orval logo" />
          </div>
          <div>
            <h1 class="page-title">{{ title() }}</h1>
            <p class="page-sub">Browse pets from the default generated Angular client</p>
          </div>
        </div>
      </div>

      @if (pets$ | async; as pets) {
        <div class="pets-grid" role="list" aria-label="Pets list">
          @for (pet of pets; track pet.id) {
            <article class="pet-card" role="listitem">
              <div class="pet-card-header">
                <span class="pet-card-id">#{{ pet.id }}</span>
                @if (pet.status) {
                  <span class="status-dot" [class]="'status-' + pet.status"></span>
                }
              </div>
              <h2 class="pet-card-name">{{ pet.name }}</h2>
              @if (pet.tag) {
                <span class="pet-card-tag">{{ pet.tag }}</span>
              }
            </article>
          }
        </div>
      } @else {
        <div class="loading-state" aria-live="polite">
          <span class="loading-dot"></span>
          <span class="loading-dot"></span>
          <span class="loading-dot"></span>
          <span>Loading pets…</span>
        </div>
      }

      <div class="devnote">
        <span class="devnote-badge">DEV</span>
        <span>Content type overload tests (issue #2243) — check browser console for text/xml/json/default response shapes.</span>
      </div>
    </div>
  `,
  styles: `
    .pets-page {
      max-width: 900px;
      margin: 0 auto;
    }

    /* ── Page header ── */
    .page-header {
      margin-bottom: 36px;
    }

    .page-header-inner {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .logo-glow {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      border-radius: 14px;
      background: var(--accent-dim);
      border: 1px solid var(--accent-glow);
      box-shadow:
        0 0 24px var(--accent-glow),
        inset 0 0 12px var(--accent-dim);
      flex-shrink: 0;
      transition: box-shadow 0.3s ease;

      &:hover {
        box-shadow:
          0 0 40px var(--accent-glow),
          inset 0 0 20px var(--accent-dim);
      }
    }

    .page-title {
      font-family: var(--font-display);
      font-size: 2.2rem;
      font-weight: 800;
      color: var(--text);
      letter-spacing: -0.03em;
      margin: 0;
    }

    .page-sub {
      color: var(--text-2);
      font-size: 0.875rem;
      margin-top: 4px;
    }

    /* ── Grid ── */
    .pets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 32px;
    }

    .pet-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
      animation: cardIn 0.3s ease backwards;
      cursor: default;

      &:hover {
        border-color: var(--border-2);
        box-shadow: 0 4px 20px oklch(0 0 0 / 0.5);
        transform: translateY(-2px);
      }
    }

    .pet-card:nth-child(1)  { animation-delay: 0.05s; }
    .pet-card:nth-child(2)  { animation-delay: 0.10s; }
    .pet-card:nth-child(3)  { animation-delay: 0.15s; }
    .pet-card:nth-child(4)  { animation-delay: 0.20s; }
    .pet-card:nth-child(5)  { animation-delay: 0.25s; }
    .pet-card:nth-child(6)  { animation-delay: 0.30s; }
    .pet-card:nth-child(7)  { animation-delay: 0.35s; }
    .pet-card:nth-child(8)  { animation-delay: 0.40s; }
    .pet-card:nth-child(9)  { animation-delay: 0.45s; }
    .pet-card:nth-child(10) { animation-delay: 0.50s; }

    .pet-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .pet-card-id {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      color: var(--text-3);
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--text-3);

      &.status-available { background: var(--success); box-shadow: 0 0 6px var(--success); }
      &.status-pending   { background: var(--warning); box-shadow: 0 0 6px var(--warning); }
      &.status-sold      { background: var(--text-3); }
    }

    .pet-card-name {
      font-family: var(--font-display);
      font-size: 1rem;
      font-weight: 700;
      color: var(--text);
      margin: 0 0 8px;
      letter-spacing: -0.01em;
    }

    .pet-card-tag {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      color: var(--accent);
      background: var(--accent-dim);
      padding: 2px 7px;
      border-radius: 3px;
    }

    /* ── Loading ── */
    .loading-state {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      color: var(--text-3);
      margin-bottom: 32px;
    }

    .loading-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--accent);
      animation: pulse 1.2s ease-in-out infinite;
      opacity: 0.6;

      &:nth-child(2) { animation-delay: 0.2s; }
      &:nth-child(3) { animation-delay: 0.4s; }
    }

    /* ── Dev note ── */
    .devnote {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 16px;
      background: var(--surface);
      border: 1px dashed var(--border-2);
      border-radius: 8px;
      font-size: 0.8rem;
      color: var(--text-3);
    }

    .devnote-badge {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 1px 6px;
      border-radius: 3px;
      background: var(--surface-2);
      color: var(--text-3);
      border: 1px solid var(--border-2);
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* ── Animations ── */
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.3; transform: scale(0.8); }
      50%       { opacity: 1;   transform: scale(1.2); }
    }

    @media (max-width: 480px) {
      .pets-grid {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class PetsStorePage implements OnInit {
  private readonly petService = inject(PetsService);

  protected readonly pets$ = this.petService.listPets();
  protected readonly title = signal('Pet Store');

  ngOnInit() {
    this.petService.showPetById('1', 'text/plain').subscribe({
      next: (result) =>
        console.log('[text/plain] Result:', result, '| Type:', typeof result),
      error: (err) => console.error('[text/plain] Error:', err),
    });

    this.petService.showPetById('1', 'application/xml').subscribe({
      next: (result) =>
        console.log(
          '[application/xml] Result:',
          result,
          '| Type:',
          typeof result,
        ),
      error: (err) => console.error('[application/xml] Error:', err),
    });

    this.petService.showPetById('1', 'application/json').subscribe({
      next: (result) =>
        console.log(
          '[application/json] Result:',
          result,
          '| Type:',
          typeof result,
        ),
      error: (err) => console.error('[application/json] Error:', err),
    });

    this.petService.showPetById('1').subscribe({
      next: (result) =>
        console.log('[default] Result:', result, '| Type:', typeof result),
      error: (err) => console.error('[default] Error:', err),
    });
  }
}
