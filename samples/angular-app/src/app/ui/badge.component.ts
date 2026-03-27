import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

type BadgeTone = 'accent' | 'neutral' | 'success' | 'error';
type BadgeSize = 'xs' | 'sm' | 'md';
type BadgeShape = 'pill' | 'tag';

@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'badge',
    '[class.badge--pill]': "shape() === 'pill'",
    '[class.badge--tag]': "shape() === 'tag'",
    '[class.badge--xs]': "size() === 'xs'",
    '[class.badge--sm]': "size() === 'sm'",
    '[class.badge--md]': "size() === 'md'",
    '[class.badge--accent]': "tone() === 'accent'",
    '[class.badge--neutral]': "tone() === 'neutral'",
    '[class.badge--success]': "tone() === 'success'",
    '[class.badge--error]': "tone() === 'error'",
    '[class.badge--uppercase]': 'uppercase()',
  },
  template: ` <ng-content /> `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-family: var(--font-mono);
      font-weight: 700;
      letter-spacing: 0.06em;
      white-space: nowrap;
      border: 1px solid transparent;
    }

    :host(.badge--uppercase) {
      text-transform: uppercase;
    }

    :host(.badge--pill) {
      border-radius: 999px;
    }

    :host(.badge--tag) {
      border-radius: 6px;
    }

    :host(.badge--xs) {
      font-size: 0.65rem;
      padding: 2px 7px;
    }

    :host(.badge--sm) {
      font-size: 0.72rem;
      padding: 4px 10px;
    }

    :host(.badge--md) {
      font-size: 0.78rem;
      padding: 5px 12px;
    }

    :host(.badge--accent) {
      background: var(--accent-dim);
      color: var(--accent);
      border-color: var(--accent-glow);
    }

    :host(.badge--neutral) {
      background: var(--surface-2);
      color: var(--text-3);
      border-color: var(--border-2);
    }

    :host(.badge--success) {
      background: var(--success-dim);
      color: var(--success);
      border-color: oklch(0.75 0.16 148 / 0.3);
    }

    :host(.badge--error) {
      background: var(--error-dim);
      color: var(--error);
      border-color: oklch(0.68 0.22 22 / 0.3);
    }
  `,
})
export class BadgeComponent {
  readonly tone = input<BadgeTone>('accent');
  readonly size = input<BadgeSize>('sm');
  readonly shape = input<BadgeShape>('pill');
  readonly uppercase = input(true, { transform: booleanAttribute });
}
