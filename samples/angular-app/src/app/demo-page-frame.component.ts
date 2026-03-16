import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { BadgeComponent } from './ui/badge.component';

@Component({
  selector: 'app-demo-page-frame',
  imports: [BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="demo-page">
      <header class="hero">
        <div class="hero-brand">
          <div class="hero-copy">
            <p class="eyebrow">{{ eyebrow() }}</p>
            <div class="title-row">
              <h1 class="page-title">{{ title() }}</h1>
              @if (badge(); as badge) {
                <app-badge>{{ badge }}</app-badge>
              }
            </div>
            <p class="page-description">{{ description() }}</p>
          </div>
        </div>

        <div class="summary-grid">
          @if (highlights().length) {
            <article class="summary-card">
              <h2>What this page showcases</h2>
              <ul>
                @for (highlight of highlights(); track highlight) {
                  <li>{{ highlight }}</li>
                }
              </ul>
            </article>
          }

          <article class="summary-card">
            <h2>Why it matters</h2>
            <p>{{ why() }}</p>
          </article>
        </div>
      </header>

      <div class="page-content">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .demo-page {
      max-width: 1080px;
      margin: 0 auto;
    }

    .hero {
      display: grid;
      gap: 20px;
      margin-bottom: 28px;
    }

    .hero-brand {
      display: grid;
    }

    .hero-copy {
      display: grid;
      gap: 8px;
      max-width: 720px;
    }

    .eyebrow {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
    }

    .title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .page-title {
      font-family: var(--font-display);
      font-size: clamp(2rem, 4vw, 2.75rem);
      line-height: 1.05;
      letter-spacing: -0.04em;
      color: var(--text);
    }
    .page-description {
      color: var(--text-2);
      font-size: 0.98rem;
      line-height: 1.75;
      max-width: 68ch;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .summary-card {
      display: grid;
      gap: 10px;
      padding: 18px 20px;
      background: linear-gradient(180deg, var(--surface), var(--surface-2));
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: 0 16px 40px oklch(0 0 0 / 0.18);
    }

    .summary-card h2 {
      font-family: var(--font-mono);
      font-size: 0.82rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-2);
    }

    .summary-card p,
    .summary-card li {
      color: var(--text);
      font-size: 0.92rem;
      line-height: 1.7;
    }

    .summary-card ul {
      padding-left: 18px;
      display: grid;
      gap: 6px;
    }

    .page-content {
      display: grid;
      gap: 16px;
    }

    @media (max-width: 720px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class DemoPageFrameComponent {
  readonly eyebrow = input('Orval Angular sample');
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly why = input.required<string>();
  readonly badge = input<string | null>(null);
  readonly highlights = input<readonly string[]>([]);
}
