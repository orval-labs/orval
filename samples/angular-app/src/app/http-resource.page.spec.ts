import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HttpResourcePage } from './http-resource.page';

describe('HttpResourcePage', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpResourcePage],
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

  it('renders fetched httpResource data from the Angular testing backend', async () => {
    const fixture = TestBed.createComponent(HttpResourcePage);
    fixture.detectChanges();

    const listReq = httpMock.expectOne('/v1/pets');
    expect(listReq.request.method).toBe('GET');
    expect(listReq.request.headers.get('Accept')).toBe('application/json');
    listReq.flush([
      {
        id: 1,
        name: 'Rex',
        requiredNullableString: null,
      },
      {
        id: 2,
        name: 'Milo',
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

    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Status: resolved');
    expect(compiled.textContent).toContain('Rex');
    expect(compiled.textContent).toContain('Milo');
    expect(compiled.textContent).toContain('Rex (#1)');
  });

  it('renders backend errors without unsafe value() access', async () => {
    const fixture = TestBed.createComponent(HttpResourcePage);
    fixture.detectChanges();

    const listReq = httpMock.expectOne('/v1/pets');
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
});
