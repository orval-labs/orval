import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.card--interactive]': 'interactive()',
  },
  template: ` <ng-content /> `,
  styles: `
    :host {
      display: block;
      background: linear-gradient(180deg, var(--surface), var(--surface-2));
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 14px 32px oklch(0 0 0 / 0.18);
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease,
        transform 0.2s ease;
    }

    :host(.card--interactive):hover {
      border-color: var(--border-2);
      box-shadow: 0 18px 36px oklch(0 0 0 / 0.24);
      transform: translateY(-2px);
    }
  `,
})
export class CardComponent {
  readonly interactive = input(false);
}
