import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { z } from 'zod';

import { PetsService } from '../api/endpoints-zod-both/pets/pets.service';

/**
 * Runtime behaviour tests for the `runtimeValidation: { strategy: 'both' }`
 * Angular HttpClient client.
 *
 * `both` should, on an invalid response: (1) `console.error` the raw `ZodError`
 * for production visibility, and (2) still throw so the failure surfaces through
 * the RxJS error channel. A valid response should pass through untouched with no
 * logging.
 */
describe('endpoints-zod-both PetsService (runtimeValidation: both)', () => {
  let service: PetsService;
  let httpMock: HttpTestingController;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const searchParams = {
    requirednullableString: null,
    requirednullableStringTwo: 'test',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(PetsService);
    httpMock = TestBed.inject(HttpTestingController);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    httpMock.verify();
    consoleErrorSpy.mockRestore();
  });

  it('logs the raw ZodError and throws when the response is invalid', async () => {
    const error = await new Promise<unknown>((resolve, reject) => {
      service.searchPets(searchParams, 1).subscribe({
        next: (value) => reject(new Error(`expected error, got ${value}`)),
        error: resolve,
      });

      // `id` is required to be a number >= 1; a string fails validation.
      httpMock
        .expectOne((req) => req.url.includes('/search'))
        .flush([{ id: 'not-a-number', name: 'Rex' }]);
    });

    expect(error).toBeInstanceOf(z.ZodError);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[orval] searchPets response validation failed',
      expect.any(z.ZodError),
    );
  });

  it('passes a valid response through without logging', async () => {
    const validPets = [
      { id: 1, name: 'Rex', tag: 'dog', requiredNullableString: null },
    ];

    const result = await new Promise<unknown>((resolve, reject) => {
      service.searchPets(searchParams, 1).subscribe({
        next: resolve,
        error: reject,
      });

      httpMock
        .expectOne((req) => req.url.includes('/search'))
        .flush(validPets);
    });

    // `both` returns the Zod *output*, so schema defaults (status) are applied.
    expect(result).toEqual([
      {
        id: 1,
        name: 'Rex',
        tag: 'dog',
        requiredNullableString: null,
        status: 'available',
      },
    ]);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
