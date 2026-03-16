import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'application',
  },
  template: `
    <header class="app-header">
      <div class="brand">
        <div class="logo-wrap">
          <img src="logo.svg" width="83" height="28" alt="Orval logo" />
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
          <span class="nav-icon">◎</span> HttpClient
        </a>
        <a
          routerLink="/http-client-custom-params"
          #customParamsRla="routerLinkActive"
          routerLinkActive="active"
          [attr.aria-current]="customParamsRla.isActive ? 'page' : null"
          class="nav-link"
        >
          <span class="nav-icon">⟲</span> HttpClient + Params
        </a>
        <a
          routerLink="/http-resource"
          #httpResourceRla="routerLinkActive"
          routerLinkActive="active"
          [attr.aria-current]="httpResourceRla.isActive ? 'page' : null"
          class="nav-link"
        >
          <span class="nav-icon">◌</span> httpResource
        </a>
        <a
          routerLink="/http-resource-zod"
          #httpResourceZodRla="routerLinkActive"
          routerLinkActive="active"
          [attr.aria-current]="httpResourceZodRla.isActive ? 'page' : null"
          class="nav-link"
        >
          <span class="nav-icon">⬢</span> httpResource + Zod
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
      justify-content: flex-start;
      align-items: center;
      gap: 16px;
      padding: 12px 32px;
      min-height: 64px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);

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
      position: relative;
      z-index: 1;
      flex-shrink: 0;
    }

    .logo-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 36px;
      padding: 0 10px;
      border-radius: 8px;
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
      flex: 1;
      gap: 4px;
      flex-wrap: wrap;
      justify-content: flex-start;
      align-items: center;
      margin-left: 8px;
      position: relative;
      z-index: 1;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      flex-shrink: 0;
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

    @media (max-width: 960px) {
      .app-header {
        align-items: flex-start;
        padding-inline: 20px;
      }

      .nav-bar {
        width: 100%;
        flex: 0 0 100%;
        justify-content: flex-start;
        flex-wrap: nowrap;
        overflow-x: auto;
        margin-left: 0;
        padding-bottom: 4px;
        scrollbar-width: thin;
        scrollbar-color: var(--border-2) transparent;
      }

      .nav-bar::-webkit-scrollbar {
        height: 6px;
      }

      .nav-bar::-webkit-scrollbar-thumb {
        background: var(--border-2);
        border-radius: 999px;
      }

      main {
        padding: 32px 20px 24px;
      }
    }

    @media (max-width: 720px) {
      .brand-tag {
        display: none;
      }
    }

    main {
      flex: 1;
      padding: 40px 32px 32px;
      background: var(--bg);
    }

    @media (max-width: 600px) {
      .app-header {
        padding: 0 16px;
        height: auto;
        padding-block: 12px;
      }

      main {
        padding: 28px 16px 20px;
      }
    }
  `,
})
export class AppShell {}
