import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HttpResourceZodPage } from './http-resource-zod.page';

describe('HttpResourceZodPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpResourceZodPage],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  it('should create the page', () => {
    const fixture = TestBed.createComponent(HttpResourceZodPage);
    const page = fixture.componentInstance;
    expect(page).toBeTruthy();
  });

  it('should render the zod page heading', () => {
    const fixture = TestBed.createComponent(HttpResourceZodPage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain(
      'httpResource + Zod output',
    );
  });
});
