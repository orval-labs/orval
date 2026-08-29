import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  provideTanStackQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { z } from 'zod';

import {
  listPets,
  showPetById,
  deletePetById,
} from '../api/endpoints-zod/pets/pets';

describe('Angular Query Zod Runtime Validation', () => {
  let queryClient: QueryClient;
  let httpCtrl: HttpTestingController;
  let http: HttpClient;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTanStackQuery(queryClient),
      ],
    });

    httpCtrl = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    queryClient.clear();
    httpCtrl.verify();
    consoleErrorSpy.mockRestore();
  });

  it('deletePetById (void response) should NOT contain .parse()', () => {
    const fnSource = deletePetById.toString();
    expect(fnSource).not.toContain('.parse(');
  });

  it('listPets should validate response data via Zod and return parsed result', async () => {
    const mockPets = [
      {
        id: 1,
        name: 'Fluffy',
        type: 'dog',
        barksPerMinute: 5,
        cuteness: 10,
        breed: 'Labradoodle',
      },
    ];
    const resultPromise = listPets(http, { sort: 'name', limit: '10' });

    const req = httpCtrl.expectOne((r) => r.url === '/pets');
    expect(req.request.method).toBe('GET');
    req.flush(mockPets);

    const result = await resultPromise;
    expect(result).toEqual(mockPets);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('listPets should log and throw a ZodError when response data is invalid', async () => {
    // id should be a number, name should be a string — sending wrong types
    const invalidData = [{ id: 'not-a-number', name: 123 }];
    const resultPromise = listPets(http, { sort: 'name', limit: '10' });

    const req = httpCtrl.expectOne((r) => r.url === '/pets');
    req.flush(invalidData);

    await expect(resultPromise).rejects.toBeInstanceOf(z.ZodError);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[orval] listPets response validation failed',
      expect.any(z.ZodError),
    );
  });

  it('showPetById should validate response via Zod', async () => {
    const mockPet = {
      id: 1,
      name: 'Rex',
      type: 'dog',
      barksPerMinute: 3,
      cuteness: 8,
      breed: 'Labradoodle',
    };
    const resultPromise = showPetById(http, '1');

    const req = httpCtrl.expectOne('/pets/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockPet);

    const result = await resultPromise;
    expect(result).toEqual(mockPet);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
