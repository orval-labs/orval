import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HttpResourceZodPage } from './http-resource-zod.page';

describe('HttpResourceZodPage', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpResourceZodPage],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  const flushSuccessfulRequests = () => {
    const listReq = httpMock.expectOne('/v1/pets');
    expect(listReq.request.method).toBe('GET');
    expect(listReq.request.headers.get('Accept')).toBe('application/json');
    listReq.flush([
      {
        id: 1,
        name: 'Rex',
        requiredNullableString: null,
      },
    ]);

    const petReq = httpMock.expectOne('/v1/pets/1');
    expect(petReq.request.method).toBe('GET');
    expect(petReq.request.headers.get('Accept')).toBe('application/json');
    petReq.flush({
      id: 1,
      name: 'Rex',
      requiredNullableString: null,
    });
  };

  it('should create the page', () => {
    const fixture = TestBed.createComponent(HttpResourceZodPage);
    const page = fixture.componentInstance;
    expect(page).toBeTruthy();
  });

  it('renders validated httpResource data from HttpTestingController responses', async () => {
    const fixture = TestBed.createComponent(HttpResourceZodPage);
    fixture.detectChanges();

    flushSuccessfulRequests();

    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'httpResource + Zod',
    );
    expect(compiled.textContent).toContain('Status: resolved');
    expect(compiled.textContent).toContain('Rex');
  });

  it('surfaces backend errors without throwing from guarded value() reads', async () => {
    const fixture = TestBed.createComponent(HttpResourceZodPage);
    fixture.detectChanges();

    const listReq = httpMock.expectOne('/v1/pets');
    expect(listReq.request.headers.get('Accept')).toBe('application/json');
    listReq.flush('Failed!', {
      status: 500,
      statusText: 'Internal Server Error',
    });

    const petReq = httpMock.expectOne('/v1/pets/1');
    petReq.flush({
      id: 1,
      name: 'Rex',
      requiredNullableString: null,
    });

    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Failed to load pets:');
    expect(compiled.textContent).toContain('Rex (#1)');
  });

  it('surfaces Zod parse failures when runtimeValidation is enabled', async () => {
    const fixture = TestBed.createComponent(HttpResourceZodPage);
    fixture.detectChanges();

    const listReq = httpMock.expectOne('/v1/pets');
    expect(listReq.request.headers.get('Accept')).toBe('application/json');
    listReq.flush([
      {
        id: 1,
        name: 'Rex',
      },
    ]);

    const petReq = httpMock.expectOne('/v1/pets/1');
    petReq.flush({
      id: 1,
      name: 'Rex',
      requiredNullableString: null,
    });

    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.componentInstance as HttpResourceZodPage & {
      listResource: { error(): Error | undefined };
    };
    expect(page.listResource.error()?.name).toBe('ZodError');
    expect(page.listResource.error()?.message).toContain(
      'requiredNullableString',
    );

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Failed to load pets:');
    expect(compiled.textContent).toContain('Rex (#1)');
  });
});
