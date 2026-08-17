import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HttpBothPage } from './http-both.page';

describe('HttpBothPage', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpBothPage],
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

  it('renders both the HttpClient and httpResource panels for the same /v1/pets endpoint', async () => {
    const fixture = TestBed.createComponent(HttpBothPage);
    fixture.detectChanges();

    const requests = httpMock.match('/v1/pets');
    expect(requests.length).toBe(2);

    for (const req of requests) {
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Accept')).toBe('application/json');
      req.flush([
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
    }

    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('PetsService.listPets()');
    expect(compiled.textContent).toContain('listPetsResource()');
    expect(compiled.textContent).toContain('Status: success');
    expect(compiled.textContent).toContain('Status: resolved');

    const lists = compiled.querySelectorAll('.pet-grid');
    expect(lists.length).toBe(2);
    for (const list of Array.from(lists)) {
      expect(list.textContent).toContain('Rex');
      expect(list.textContent).toContain('Milo');
    }
  });

  it('renders backend errors from both panels without unsafe value() access', async () => {
    const fixture = TestBed.createComponent(HttpBothPage);
    fixture.detectChanges();

    const requests = httpMock.match('/v1/pets');
    expect(requests.length).toBe(2);

    for (const req of requests) {
      req.flush('Failed!', {
        status: 500,
        statusText: 'Internal Server Error',
      });
    }

    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const errorMessages = compiled.querySelectorAll('.error');
    expect(errorMessages.length).toBe(2);
    for (const message of Array.from(errorMessages)) {
      expect(message.textContent).toContain('Failed to load pets:');
    }
  });
});
