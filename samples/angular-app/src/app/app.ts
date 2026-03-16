import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="App">
      <h1>Hello, {{ title() }}</h1>
      <header class="App-header">
        <img src="logo.svg" class="App-logo" alt="logo" />
      </header>
      <nav class="App-nav">
        <a routerLink="/http-client" routerLinkActive="active">HttpClient</a>
        <a routerLink="/http-client-custom-params" routerLinkActive="active">
          HttpClient custom params
        </a>
        <a routerLink="/http-resource" routerLinkActive="active">
          httpResource
        </a>
        <a routerLink="/http-resource-zod" routerLinkActive="active">
          httpResource + Zod
        </a>
        <a routerLink="/zod-demo" routerLinkActive="active"> Zod validation </a>
      </nav>
      <main>
        <router-outlet />
      </main>
    </div>
  `,
})
export class App {
  protected readonly title = signal('angular-app');
}
