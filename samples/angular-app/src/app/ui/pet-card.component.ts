import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CardComponent } from './card.component';

type PetStatus = 'available' | 'pending' | 'sold';

type PetCardData = Readonly<{
  id: number | string;
  name: string;
  tag?: string | null;
  status?: PetStatus | null;
}>;

@Component({
  selector: 'app-pet-card',
  imports: [CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'listitem',
  },
  template: `
    <app-card [interactive]="true">
      <div class="pet-card-header">
        <span class="pet-card-id">#{{ pet().id }}</span>
        @if (pet().status) {
          <span
            class="status-dot"
            [class]="'status-dot status-' + pet().status"
          ></span>
        }
      </div>

      <h3 class="pet-card-name">{{ pet().name }}</h3>

      @if (pet().tag) {
        <span class="pet-card-tag">{{ pet().tag }}</span>
      }
    </app-card>
  `,
  styles: `
    :host {
      display: block;
      animation: cardIn 0.3s ease backwards;
    }

    .pet-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .pet-card-id {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      color: var(--text-3);
      word-break: break-all;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--text-3);
      box-shadow: 0 0 10px oklch(0 0 0 / 0.25);
      flex-shrink: 0;
    }

    .status-available {
      background: var(--success);
      box-shadow: 0 0 12px var(--success);
    }

    .status-pending {
      background: var(--warning);
      box-shadow: 0 0 12px var(--warning);
    }

    .status-sold {
      background: var(--text-3);
    }

    .pet-card-name {
      font-family: var(--font-display);
      font-size: 1rem;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -0.02em;
      margin-bottom: 16px;
      line-height: 1.2;
    }

    .pet-card-tag {
      display: inline-flex;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 0.72rem;
      color: var(--accent);
      background: var(--accent-dim);
      border: 1px solid var(--accent-glow);
      padding: 4px 10px;
      border-radius: 8px;
    }

    @keyframes cardIn {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
})
export class PetCardComponent {
  readonly pet = input.required<PetCardData>();
}
