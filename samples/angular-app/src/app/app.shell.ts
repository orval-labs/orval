import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="nav-bar">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
        Pets Demo
      </a>
      <a routerLink="/zod-demo" routerLinkActive="active">
        Zod Validation Demo
      </a>
    </nav>
    <router-outlet />
  `,
  styles: `
    .nav-bar {
      display: flex;
      gap: 16px;
      padding: 12px 24px;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
      font-family: sans-serif;
    }
    .nav-bar a {
      text-decoration: none;
      color: #333;
      padding: 6px 12px;
      border-radius: 4px;
    }
    .nav-bar a.active {
      background: #1976d2;
      color: #fff;
    }
  `,
})
export class AppShell {}
