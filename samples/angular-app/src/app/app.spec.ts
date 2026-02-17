import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { AppHome } from './app';
import { AppShell } from './app.shell';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppHome],
      providers: [provideZonelessChangeDetection(), provideHttpClient()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppHome);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppHome);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Hello, angular-app',
    );
  });

  it('should render pets', async () => {
    const fixture = TestBed.createComponent(AppHome);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('p').length).toBeGreaterThanOrEqual(1);
  });
});

describe('AppShell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter(routes),
      ],
    }).compileComponents();
  });

  it('should create the shell', () => {
    const fixture = TestBed.createComponent(AppShell);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render navigation links', () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const nav = compiled.querySelector('nav');
    expect(nav).toBeTruthy();
    const links = nav!.querySelectorAll('a');
    expect(links.length).toBe(2);
    expect(links[0].textContent).toContain('Pets Demo');
    expect(links[1].textContent).toContain('Zod Validation Demo');
  });

  it('should have a router outlet', () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    // router-outlet renders as a comment node, check for the element
    expect(
      fixture.debugElement.nativeElement.parentElement.querySelector(
        'router-outlet',
      ) || compiled.innerHTML.includes('router-outlet'),
    ).toBeTruthy();
  });
});
