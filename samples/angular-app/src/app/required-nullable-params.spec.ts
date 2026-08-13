import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PetsService } from '../api/http-client/pets/pets.service';

// Issue #3712: a query param the spec declares required+nullable must still
// reach the wire when its runtime value is null, or the request violates the
// OpenAPI contract. Without a paramsSerializer, orval now sends such a value
// as an empty string (`?key=`) instead of silently dropping the key.
describe('required+nullable query params (issue #3712)', () => {
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

  it('sends a required nullable param as an empty string instead of dropping the key', () => {
    petsService
      .searchPets({
        requirednullableString: null,
        requirednullableStringTwo: 'demo',
      })
      .subscribe();

    const req = httpMock.expectOne(
      (r) =>
        r.url === '/v1/search' &&
        r.params.get('requirednullableString') === '' &&
        r.params.get('requirednullableStringTwo') === 'demo',
    );
    expect(req.request.params.has('requirednullableString')).toBe(true);
    req.flush([]);
  });
});
