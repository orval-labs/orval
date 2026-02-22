import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'application',
  },
  template: `
    <header class="app-header">
      <div class="brand">
        <div class="logo-wrap">
          <img
            ngSrc="logo.svg"
            width="28"
            height="28"
            priority
            alt="Orval logo"
          />
        </div>
        <div class="brand-copy">
          <span class="brand-name">orval</span>
          <span class="brand-tag">angular&nbsp;·&nbsp;demo</span>
        </div>
      </div>

      <nav class="nav-bar" role="navigation" aria-label="Main navigation">
        <a
          routerLink="/"
          #petsRla="routerLinkActive"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          [attr.aria-current]="petsRla.isActive ? 'page' : null"
          class="nav-link"
        >
          <span class="nav-icon">◈</span> Pet Store
        </a>
        <a
          routerLink="/zod-demo"
          #zodRla="routerLinkActive"
          routerLinkActive="active"
          [attr.aria-current]="zodRla.isActive ? 'page' : null"
          class="nav-link"
        >
          <span class="nav-icon">⬡</span> Zod Validation
        </a>
      </nav>
    </header>

    <main role="main">
      <router-outlet />
    </main>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: var(--bg);
    }

    .app-header {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 0 32px;
      height: 56px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap;

      /* subtle noise texture */
      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
        pointer-events: none;
      }
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: var(--accent-dim);
      border: 1px solid var(--accent-glow);
      box-shadow: 0 0 12px var(--accent-glow);
      transition: box-shadow 0.3s ease;

      &:hover {
        box-shadow: 0 0 20px var(--accent-glow);
      }
    }

    .brand-copy {
      display: flex;
      flex-direction: column;
      line-height: 1;
      gap: 2px;
    }

    .brand-name {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.1rem;
      color: var(--text);
      letter-spacing: -0.02em;
    }

    .brand-tag {
      font-family: var(--font-mono);
      font-size: 0.65rem;
      color: var(--accent);
      letter-spacing: 0.05em;
      text-transform: lowercase;
    }

    .nav-bar {
      display: flex;
      gap: 4px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      color: var(--text-2);
      padding: 6px 14px;
      border-radius: 6px;
      font-family: var(--font-sans);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition:
        color 0.2s ease,
        background 0.2s ease;
      border: 1px solid transparent;

      &:hover {
        color: var(--text);
        background: var(--surface-2);
        border-color: var(--border);
      }

      &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      &.active {
        color: var(--accent);
        background: var(--accent-dim);
        border-color: var(--accent-glow);
        font-weight: 600;
      }
    }

    .nav-icon {
      font-size: 0.75rem;
      opacity: 0.7;
    }

    main {
      flex: 1;
      padding: 32px;
      background: var(--bg);
    }

    @media (max-width: 600px) {
      .app-header {
        padding: 0 16px;
        height: auto;
        padding-block: 12px;
      }
      main {
        padding: 20px 16px;
      }
    }
  `,
})
export class AppShell {}
