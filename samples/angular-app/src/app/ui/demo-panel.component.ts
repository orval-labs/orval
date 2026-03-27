import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

import { CardComponent } from './card.component';

@Component({
  selector: 'app-demo-panel',
  imports: [CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card>
      <div class="panel-header" [class.panel-header--compact]="compact()">
        <div class="panel-copy">
          <h2>{{ title() }}</h2>
          @if (description(); as description) {
            <p>{{ description }}</p>
          }
        </div>

        <ng-content select="[panel-badge]" />
      </div>

      <ng-content />
    </app-card>
  `,
  styles: `
    :host {
      display: block;
    }

    .panel-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .panel-copy {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .panel-header h2 {
      font-size: 1rem;
      margin: 0;
    }

    .panel-header p {
      color: var(--text-2);
      font-size: 0.9rem;
      margin: 0;
    }

    .panel-header--compact h2 {
      font-size: 0.95rem;
    }
  `,
})
export class DemoPanelComponent {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly compact = input(false, { transform: booleanAttribute });
}
