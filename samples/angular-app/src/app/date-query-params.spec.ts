import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PetsService } from '../api/http-client/pets/pets.service';

// Issue #3856: a query param declared with `format: date-time` must survive
// filterParams as an ISO string when the caller passes a JS `Date`, or the
// generated client silently drops the key from the request.
describe('date query params (issue #3856)', () => {
  let httpMock: HttpTestingController;
  let petsService: PetsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpMock = TestBed.inject(HttpTestingController);
    petsService = TestBed.inject(PetsService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('serializes a Date query param to an ISO string instead of dropping it', () => {
    petsService
      .searchPets({
        requirednullableString: null,
        requirednullableStringTwo: 'demo',
        since: new Date('2026-01-02T03:04:05.000Z'),
      })
      .subscribe();

    const req = httpMock.expectOne(
      (r) =>
        r.url === '/v1/search' &&
        r.params.get('since') === '2026-01-02T03:04:05.000Z',
    );
    expect(req.request.params.get('since')).toBe('2026-01-02T03:04:05.000Z');
    req.flush([]);
  });
});
