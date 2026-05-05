import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PetsStorePage } from './pets-store.page';

describe('PetsStorePage', () => {
  let httpMock: HttpTestingController;

  const flushInitialRequests = () => {
    const listReq = httpMock.expectOne('/v1/pets');
    expect(listReq.request.method).toBe('GET');
    listReq.flush([
      {
        id: 1,
        name: 'Rex',
        tag: 'dog',
        requiredNullableString: null,
      },
      {
        id: 2,
        name: 'Milo',
        tag: 'cat',
        requiredNullableString: null,
      },
    ]);

    const detailReqs = httpMock.match('/v1/pets/1');
    expect(detailReqs.length).toBe(3);

    for (const req of detailReqs) {
      const accept = req.request.headers.get('Accept');

      if (accept === 'text/plain') {
        req.flush('Pet 1: Rex the dog');
        continue;
      }

      if (accept === 'application/xml') {
        req.flush('<pet><id>1</id><name>Rex</name></pet>');
        continue;
      }

      expect(accept === 'application/json' || accept === null).toBe(true);
      req.flush({
        id: 1,
        name: 'Rex',
        tag: 'dog',
        requiredNullableString: null,
      });
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PetsStorePage],
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

  it('renders the merged HttpClient overview with list and overload sections', async () => {
    const fixture = TestBed.createComponent(PetsStorePage);
    fixture.detectChanges();

    flushInitialRequests();

    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'HttpClient overview',
    );
    expect(compiled.textContent).toContain('listPets()');
    expect(compiled.textContent).toContain('createPets()');
    expect(compiled.textContent).toContain('showPetById()');
    expect(compiled.textContent).toContain('Rex');
    expect(compiled.textContent).toContain('Milo');
    expect(compiled.textContent).toContain('Pet 1: Rex the dog');
  });

  it('creates a pet and refreshes the list from the generated client', async () => {
    const fixture = TestBed.createComponent(PetsStorePage);
    fixture.detectChanges();

    flushInitialRequests();

    await fixture.whenStable();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '.btn',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    const createReq = httpMock.expectOne('/v1/pets');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual({ name: 'Buddy', tag: 'demo' });
    createReq.flush(null, { status: 201, statusText: 'Created' });

    const refreshedListReq = httpMock.expectOne('/v1/pets');
    expect(refreshedListReq.request.method).toBe('GET');
    refreshedListReq.flush([
      {
        id: 99,
        name: 'Buddy',
        tag: 'demo',
        requiredNullableString: null,
      },
      {
        id: 1,
        name: 'Rex',
        tag: 'dog',
        requiredNullableString: null,
      },
    ]);

    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Created Buddy successfully');
    expect(compiled.textContent).toContain('Buddy');
  });
});
