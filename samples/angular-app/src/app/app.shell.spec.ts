import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppShell } from './app.shell';
import { routes } from './app.routes';

describe('AppShell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [provideZonelessChangeDetection(), provideRouter(routes)],
    }).compileComponents();
  });

  it('renders the nav links with their hrefs and labels', () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    const links = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>(
        '.nav-bar a',
      ),
    );

    expect(
      links.map((link) => [
        link.getAttribute('href'),
        link.textContent?.replace(/\s+/g, ' ').trim(),
      ]),
    ).toEqual([
      ['/', '◎ HttpClient'],
      ['/http-client-custom-params', '⟲ HttpClient + Params'],
      ['/http-resource', '◌ httpResource'],
      ['/http-resource-zod', '⬢ httpResource + Zod'],
      ['/zod-demo', '⬡ Zod Validation'],
      ['/http-both', '⇄ Both Clients'],
      ['/base-url-token', '⚓ Base URL Token'],
    ]);
  });
});
